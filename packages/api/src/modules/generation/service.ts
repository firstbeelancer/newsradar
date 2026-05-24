import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { aiProviders, articles, contentTemplates, generatedPosts, workspaces } from "../../db/schema.js";
import type { GeneratedPost } from "../../db/types.js";
import { AppError } from "../../middleware/error-handler.js";
import { decodeCursor, encodeCursor } from "../../lib/pagination.js";
import type { Cursor, PaginatedResult } from "../../lib/pagination.js";
import { createOperationLog, updateOperationLog } from "../operation-logs/service.js";
import { getDefaultEmojiValues } from "../asset-packs/service.js";
import { resolveProviderForProcess } from "../ai-providers/service.js";
import {
  buildArticleContent,
  ensureLeadingEmoji,
  getGenerationCutoffDate,
  renderPromptTemplate,
  sanitizeTelegramText,
} from "./template-utils.js";

export interface GeneratePostInput {
  workspaceId: string;
  agentId?: string;
  templateId?: string;
  articleIds?: string[];
  articleCount?: number;
  customPrompt?: string;
  provider?: string;
  model?: string;
  period?: "day" | "week" | "month";
  type: "manual" | "digest" | "deepsearch";
}

export interface StreamOperation {
  id: string;
  status: "pending" | "generating" | "completed" | "error";
  content: string;
  error?: string;
  chunks: string[];
  operationLogId?: string;
  userId?: string;
}

const streamStore = new Map<string, StreamOperation>();

export async function generatePost(
  input: GeneratePostInput,
  userId: string
): Promise<{ operationId: string; status: string }> {
  const operationId = crypto.randomUUID();
  const {
    workspaceId,
    templateId,
    articleIds,
    articleCount,
    customPrompt,
    type,
    agentId,
    provider: requestedProvider,
    model: requestedModel,
    period,
  } = input;

  let template: typeof contentTemplates.$inferSelect | undefined;
  if (templateId) {
    template = await db.query.contentTemplates.findFirst({
      where: and(eq(contentTemplates.id, templateId), eq(contentTemplates.workspaceId, workspaceId)),
    });
  }

  if (!template) {
    template = await db.query.contentTemplates.findFirst({
      where: and(
        eq(contentTemplates.workspaceId, workspaceId),
        eq(contentTemplates.type, type === "digest" ? "digest" : "post"),
        eq(contentTemplates.isDefault, true)
      ),
    });
  }

  let selectedArticles: typeof articles.$inferSelect[] = [];
  if (articleIds && articleIds.length > 0) {
    selectedArticles = await db
      .select()
      .from(articles)
      .where(and(eq(articles.workspaceId, workspaceId), inArray(articles.id, articleIds)));
  } else if (agentId) {
    const cutoffDate = getGenerationCutoffDate(period);
    selectedArticles = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.workspaceId, workspaceId),
          eq(articles.agentId, agentId),
          sql`COALESCE(${articles.publishedAt}, ${articles.createdAt}) >= ${cutoffDate}`
        )
      )
      .orderBy(desc(articles.score), desc(articles.createdAt))
      .limit(articleCount ?? 10);
  }

  const articleTexts = buildArticleContent(selectedArticles);

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    columns: { config: true },
  });
  const workspacePrompts = (workspace?.config as Record<string, unknown> | undefined)?.prompts as
    | { post_generation?: string; digest_generation?: string }
    | undefined;

  const defaultSystemPrompt =
    type === "digest"
      ? (workspacePrompts?.digest_generation ?? "Ты — профессиональный аналитик новостей. Подготовь готовый к отправке дайджест на русском языке.")
      : (workspacePrompts?.post_generation ?? "Ты — сильный редактор Telegram-канала. Подготовь готовый к отправке пост на русском языке.");

  const emojiPack = await getDefaultEmojiValues(workspaceId);
  const systemPrompt = buildTelegramSystemPrompt(template?.systemPrompt ?? defaultSystemPrompt, type, emojiPack);
  const baseUserPrompt =
    renderPromptTemplate(template?.userPrompt, selectedArticles)
    ?? `На основе следующих статей создай ${type === "digest" ? "дайджест" : "пост"}:\n\n${articleTexts}`;
  const userPrompt = buildGenerationUserPrompt(baseUserPrompt, customPrompt);

  const provider = await resolveProviderForProcess(workspaceId, "generation", requestedProvider, requestedModel);
  const operationLog = await createOperationLog({
    userId,
    workspaceId,
    agentId: agentId ?? null,
    operationType: type === "digest" ? "generate_digest" : "generate_post",
    entityType: "generated_post",
    status: "pending",
    message: type === "digest" ? "Готовлю дайджест для Telegram" : "Готовлю пост для Telegram",
    metadata: {
      operationId,
      articleCount: selectedArticles.length,
      articleIds: selectedArticles.map((article) => article.id),
      templateId: template?.id ?? null,
      provider: provider?.provider ?? requestedProvider ?? null,
      model: provider?.model ?? requestedModel ?? null,
      hasFeedback: Boolean(customPrompt?.trim()),
    },
  });

  streamStore.set(operationId, {
    id: operationId,
    status: "pending",
    content: "",
    chunks: [],
    operationLogId: operationLog.id,
    userId,
  });

  void startGeneration(operationId, systemPrompt, userPrompt, provider, {
    workspaceId,
    agentId,
    templateId: template?.id ?? null,
    articles: selectedArticles,
    type,
    emojiPack,
    allowHashtags: wantsHashtags(customPrompt),
    operationLogId: operationLog.id,
    userId,
  });

  return { operationId, status: "queued" };
}

async function startGeneration(
  operationId: string,
  systemPrompt: string,
  userPrompt: string,
  provider: typeof aiProviders.$inferSelect | undefined,
  context: {
    workspaceId: string;
    agentId?: string;
    templateId: string | null;
    articles: typeof articles.$inferSelect[];
    type: string;
    emojiPack: string[];
    allowHashtags: boolean;
    operationLogId: string;
    userId: string;
  }
): Promise<void> {
  const op = streamStore.get(operationId);
  if (!op) return;

  op.status = "generating";
  streamStore.set(operationId, op);
  await updateOperationLog(context.operationLogId, context.userId, {
    status: "running",
    message: context.type === "digest" ? "Собираю финальный дайджест" : "Собираю финальный пост",
  });

  try {
    if (!provider) {
      throw new AppError(503, "Для генерации не найден активный AI-провайдер", "GENERATION_PROVIDER_NOT_FOUND");
    }

    if (!provider.apiKeyEncrypted) {
      throw new AppError(503, "Для выбранного AI-провайдера не настроен API-ключ", "GENERATION_PROVIDER_KEY_MISSING");
    }

    const { content: rawContent, modelUsed } = await callAiProvider(provider, systemPrompt, userPrompt, operationId);
    const content = ensureLeadingEmoji(
      sanitizeTelegramText(rawContent, { allowHashtags: context.allowHashtags }),
      context.emojiPack
    );

    await db
      .insert(generatedPosts)
      .values({
        workspaceId: context.workspaceId,
        agentId: context.agentId ?? null,
        templateId: context.templateId,
        type: context.type as "manual" | "digest" | "deepsearch",
        title: context.articles[0]?.title ?? "Generated post",
        content,
        articleCount: context.articles.length,
        articlesSnapshot: context.articles.map((article) => ({
          id: article.id,
          title: article.title,
          link: article.link,
          score: article.score,
        })),
        promptSnapshot: userPrompt,
        modelSnapshot: modelUsed,
      })
      .returning();

    const finalOp = streamStore.get(operationId);
    if (finalOp) {
      finalOp.status = "completed";
      finalOp.content = content;
      streamStore.set(operationId, finalOp);
    }

    await updateOperationLog(context.operationLogId, context.userId, {
      status: "completed",
      message: context.type === "digest" ? "Дайджест готов" : "Пост готов",
      finishedAt: new Date(),
      metadata: {
        articleCount: context.articles.length,
        preview: content.slice(0, 280),
      },
    });
  } catch (err) {
    const errorOp = streamStore.get(operationId);
    if (errorOp) {
      errorOp.status = "error";
      errorOp.error = err instanceof Error ? err.message : "Generation failed";
      streamStore.set(operationId, errorOp);
    }

    await updateOperationLog(context.operationLogId, context.userId, {
      status: "error",
      message: err instanceof Error ? err.message : "Generation failed",
      finishedAt: new Date(),
      metadata: {
        articleCount: context.articles.length,
      },
    });
  }
}

async function callAiProvider(
  provider: typeof aiProviders.$inferSelect,
  systemPrompt: string,
  userPrompt: string,
  operationId: string
): Promise<{ content: string; modelUsed: string }> {
  const { decrypt } = await import("../../lib/encryption.js");
  const apiKey = decrypt(provider.apiKeyEncrypted!);
  const baseUrl = provider.baseUrl ?? getDefaultBaseUrl(provider.provider);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    if (provider.provider === "openai" || provider.provider === "openrouter") {
      const result = await requestOpenAiCompatibleCompletion({
        provider,
        apiKey,
        baseUrl,
        systemPrompt,
        userPrompt,
        signal: controller.signal,
      });
      pushStreamChunk(operationId, result.content);
      return result;
    }

    if (provider.provider === "anthropic") {
      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic error ${response.status}: ${error.slice(0, 500)}`);
      }

      const data = (await response.json()) as {
        content?: Array<{ text?: string }>;
      };

      const content = data.content?.[0]?.text ?? "";
      pushStreamChunk(operationId, content);
      return {
        content,
        modelUsed: provider.model,
      };
    }

    throw new AppError(400, `Провайдер ${provider.provider} пока не поддерживает генерацию через этот endpoint`, "GENERATION_PROVIDER_UNSUPPORTED");
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryOpenRouterWithAuto(
  provider: typeof aiProviders.$inferSelect,
  status: number,
  errorText: string
) {
  if (provider.provider !== "openrouter" || provider.model === "openrouter/auto") {
    return false;
  }

  if (status === 429 || status >= 500) {
    return true;
  }

  const normalized = errorText.toLowerCase();
  return (
    normalized.includes("provider returned error") ||
    normalized.includes("temporarily rate-limited") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("no endpoints found") ||
    normalized.includes("model not found")
  );
}

function formatProviderError(status: number, errorText: string) {
  if (status === 429) {
    return "AI-провайдер временно упёрся в лимит запросов. Попробуй ещё раз через минуту или переключи модель.";
  }

  if (status >= 500) {
    return "AI-провайдер сейчас отвечает нестабильно. Попробуй повторить генерацию чуть позже.";
  }

  return `AI provider error ${status}: ${errorText.slice(0, 500)}`;
}

async function requestOpenAiCompatibleCompletion(params: {
  provider: typeof aiProviders.$inferSelect;
  apiKey: string;
  baseUrl: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  modelOverride?: string;
}): Promise<{ content: string; modelUsed: string }> {
  const model = params.modelOverride ?? params.provider.model;
  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (shouldRetryOpenRouterWithAuto(params.provider, response.status, errorText)) {
      return requestOpenAiCompatibleCompletion({
        ...params,
        modelOverride: "openrouter/auto",
      });
    }

    throw new Error(formatProviderError(response.status, errorText));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    content: data.choices?.[0]?.message?.content ?? "",
    modelUsed: model,
  };
}

function pushStreamChunk(operationId: string, content: string) {
  const op = streamStore.get(operationId);
  if (!op) return;

  op.chunks.push(content.slice(0, 200));
  op.content = content;
  streamStore.set(operationId, op);
}

function buildGenerationUserPrompt(basePrompt: string, customPrompt?: string): string {
  const feedback = customPrompt?.trim();
  if (!feedback) return basePrompt;

  return `${basePrompt}\n\nMANDATORY EDITOR FEEDBACK:\n${feedback}\n\nApply every editor instruction above explicitly. If feedback asks for tags, links, source mentions, structure, or a changed tone, include those changes in the new version.`;
}

function wantsHashtags(customPrompt?: string): boolean {
  const normalized = customPrompt?.toLowerCase() ?? "";
  return /#|хештег|хэштег|hashtag|hashtags|теги|тегов|тегами/.test(normalized);
}

function buildTelegramSystemPrompt(basePrompt: string, type: GeneratePostInput["type"], emojis: string[]): string {
  const emojiList = emojis.join(" ");

  return `${basePrompt}

ФОРМАТ ВЫВОДА:
- Верни один готовый текст для Telegram.
- Не используй Markdown: никаких #, **, *, __, \`\`\`, обратных кавычек.
- Не используй хештеги, если их явно не попросили.
- Пиши короткими абзацами, живо и по делу.
- Используй эмодзи только из этого набора: ${emojiList || "🚨 🔥 🧠 📌 📊 👀 ⚡ ✅"}.
- Итог должен быть сразу пригоден для копирования и отправки без ручной чистки.

${type === "digest"
    ? "Для дайджеста сгруппируй материалы по смыслу и оставь только самое важное."
    : "Для поста сделай сильный заход, затем 2-4 коротких абзаца по сути и финальный вывод."}`.trim();
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "google":
      return "https://generativelanguage.googleapis.com/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

export function getStreamOperation(operationId: string): StreamOperation | undefined {
  return streamStore.get(operationId);
}

export function cleanupStreamOperation(operationId: string): void {
  streamStore.delete(operationId);
}

export async function listGeneratedPosts(
  workspaceId: string,
  params: { limit: number; cursor?: string | null; agentId?: string; type?: string }
): Promise<PaginatedResult<GeneratedPost>> {
  const conditions = [eq(generatedPosts.workspaceId, workspaceId)];

  if (params.agentId) {
    conditions.push(eq(generatedPosts.agentId, params.agentId));
  }
  if (params.type) {
    conditions.push(eq(generatedPosts.type, params.type));
  }

  let query = db
    .select()
    .from(generatedPosts)
    .where(and(...conditions))
    .orderBy(desc(generatedPosts.createdAt))
    .limit(params.limit + 1);

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      query = db
        .select()
        .from(generatedPosts)
        .where(and(...conditions, sql`${generatedPosts.createdAt} < ${new Date(decoded.sortValue)}`))
        .orderBy(desc(generatedPosts.createdAt))
        .limit(params.limit + 1);
    }
  }

  const rows = await query;
  const hasMore = rows.length > params.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;

  const lastItem = data[data.length - 1];
  const nextCursor: string | null =
    hasMore && lastItem
      ? encodeCursor({
          id: lastItem.id,
          sortValue: lastItem.createdAt.toISOString(),
        } as Cursor)
      : null;

  return { data, nextCursor, hasMore };
}

export async function getGeneratedPost(id: string, workspaceId: string) {
  const post = await db.query.generatedPosts.findFirst({
    where: and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)),
  });
  if (!post) {
    throw new AppError(404, "Generated post not found", "POST_NOT_FOUND");
  }
  return post;
}

export async function updateGeneratedPost(
  id: string,
  workspaceId: string,
  data: { title?: string; content?: string }
) {
  await getGeneratedPost(id, workspaceId);

  const [updated] = await db
    .update(generatedPosts)
    .set({
      ...data,
      isEdited: true,
      updatedAt: new Date(),
    })
    .where(and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function deleteGeneratedPost(id: string, workspaceId: string) {
  await getGeneratedPost(id, workspaceId);
  await db.delete(generatedPosts).where(and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)));
  return { deleted: true };
}

export async function markAsCopied(id: string, workspaceId: string) {
  const [updated] = await db
    .update(generatedPosts)
    .set({ isCopied: true, updatedAt: new Date() })
    .where(and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)))
    .returning();
  return updated;
}
