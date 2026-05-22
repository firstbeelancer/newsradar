import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { generatedPosts, articles, contentTemplates, aiProviders, workspaces } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { GeneratedPost } from "../../db/types.js";
import { buildArticleContent, getGenerationCutoffDate, renderPromptTemplate } from "./template-utils.js";

// ─── Generation types ───

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
}

// In-memory store for stream operations (use Redis in production)
const streamStore = new Map<string, StreamOperation>();

async function resolveGenerationProvider(
  workspaceId: string,
  requestedProvider?: string,
  requestedModel?: string
) {
  const providers = await db
    .select()
    .from(aiProviders)
    .where(and(eq(aiProviders.workspaceId, workspaceId), eq(aiProviders.isActive, true)))
    .orderBy(desc(aiProviders.updatedAt), desc(aiProviders.createdAt));

  const generationAssigned = providers.filter((provider) => {
    const assignedTo = Array.isArray(provider.assignedTo) ? provider.assignedTo : [];
    return assignedTo.length === 0 || assignedTo.includes("generation");
  });

  const candidatePool = generationAssigned.length > 0 ? generationAssigned : providers;

  if (requestedProvider || requestedModel) {
    const explicitMatch = candidatePool.find((provider) => {
      const providerMatches = requestedProvider ? provider.provider === requestedProvider : true;
      const modelMatches = requestedModel ? provider.model === requestedModel : true;
      return providerMatches && modelMatches;
    });

    if (explicitMatch) return explicitMatch;
  }

  return candidatePool[0];
}

// ─── Content generation ───

export async function generatePost(
  input: GeneratePostInput,
  _userId: string
): Promise<{ operationId: string; status: string }> {
  const operationId = crypto.randomUUID();
  const { workspaceId, templateId, articleIds, articleCount, customPrompt, type, agentId, provider: requestedProvider, model: requestedModel, period } = input;

  // Resolve template
  let template: typeof contentTemplates.$inferSelect | undefined;
  if (templateId) {
    template = await db.query.contentTemplates.findFirst({
      where: and(eq(contentTemplates.id, templateId), eq(contentTemplates.workspaceId, workspaceId)),
    });
  }
  if (!template) {
    // Find default template for the type
    template = await db.query.contentTemplates.findFirst({
      where: and(
        eq(contentTemplates.workspaceId, workspaceId),
        eq(contentTemplates.type, type === "digest" ? "digest" : "post"),
        eq(contentTemplates.isDefault, true)
      ),
    });
  }

  // Fetch articles to include
  let selectedArticles: typeof articles.$inferSelect[] = [];
  if (articleIds && articleIds.length > 0) {
    selectedArticles = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.workspaceId, workspaceId),
          sql`${articles.id} = ANY(${articleIds})`
        )
      );
  } else if (agentId) {
    // Get top-scored recent articles for the agent
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

  // Build prompt — fetch workspace-level prompts as fallback
  const articleTexts = buildArticleContent(selectedArticles);

  // Fetch workspace config for base prompts
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    columns: { config: true },
  });
  const workspacePrompts = (workspace?.config as Record<string, unknown> | undefined)?.prompts as
    | { post_generation?: string; digest_generation?: string }
    | undefined;

  const defaultSystemPrompt =
    type === "digest"
      ? (workspacePrompts?.digest_generation ?? "Ты — профессиональный аналитик новостей. Подготовь структурированный дайджест на основе предоставленных статей. Пиши на русском языке.")
      : (workspacePrompts?.post_generation ?? "Ты — профессиональный редактор новостного контента. Создай увлекательный пост на основе предоставленных статей. Пиши на русском языке.");

  const systemPrompt = template?.systemPrompt ?? defaultSystemPrompt;
  const userPrompt = customPrompt
    ?? renderPromptTemplate(template?.userPrompt, selectedArticles)
    ?? `На основе следующих статей создай ${type === "digest" ? "дайджест" : "пост"}:\n\n${articleTexts}`;

  const provider = await resolveGenerationProvider(workspaceId, requestedProvider, requestedModel);

  // Initialize stream operation
  streamStore.set(operationId, {
    id: operationId,
    status: "pending",
    content: "",
    chunks: [],
  });

  // Start async generation (in production this would be a BullMQ job)
  startGeneration(operationId, systemPrompt, userPrompt, provider, {
    workspaceId,
    agentId,
    templateId: template?.id ?? null,
    articles: selectedArticles,
    type,
  });

  return { operationId, status: "queued" };
}

// ─── Async generation worker ───

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
  }
): Promise<void> {
  const op = streamStore.get(operationId);
  if (!op) return;

  op.status = "generating";
  streamStore.set(operationId, op);

  try {
    if (!provider) {
      throw new AppError(503, "Для генерации не найден активный AI-провайдер", "GENERATION_PROVIDER_NOT_FOUND");
    }

    if (!provider.apiKeyEncrypted) {
      throw new AppError(503, "Для выбранного AI-провайдера не настроен API-ключ", "GENERATION_PROVIDER_KEY_MISSING");
    }

    const content = await callAiProvider(provider, systemPrompt, userPrompt, operationId);

    // Save generated post
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
        articlesSnapshot: context.articles.map((a) => ({
          id: a.id,
          title: a.title,
          link: a.link,
          score: a.score,
        })),
        promptSnapshot: userPrompt,
        modelSnapshot: provider?.model ?? "fallback-simulated",
      })
      .returning();

    const finalOp = streamStore.get(operationId)!;
    finalOp.status = "completed";
    finalOp.content = content;
    streamStore.set(operationId, finalOp);
  } catch (err) {
    const errorOp = streamStore.get(operationId)!;
    errorOp.status = "error";
    errorOp.error = err instanceof Error ? err.message : "Generation failed";
    streamStore.set(operationId, errorOp);
  }
}

async function callAiProvider(
  provider: typeof aiProviders.$inferSelect,
  systemPrompt: string,
  userPrompt: string,
  operationId: string
): Promise<string> {
  const { decrypt } = await import("../../lib/encryption.js");
  const apiKey = decrypt(provider.apiKeyEncrypted!);
  const baseUrl = provider.baseUrl ?? getDefaultBaseUrl(provider.provider);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    if (provider.provider === "openai" || provider.provider === "openrouter") {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI provider error ${response.status}: ${error.slice(0, 500)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content ?? "";

      // Push a chunk to the stream store
      const op = streamStore.get(operationId);
      if (op) {
        op.chunks.push(content.slice(0, 200));
        op.content = content;
        streamStore.set(operationId, op);
      }

      return content;
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

      const op = streamStore.get(operationId);
      if (op) {
        op.chunks.push(content.slice(0, 200));
        op.content = content;
        streamStore.set(operationId, op);
      }

      return content;
    }

    throw new AppError(400, `Провайдер ${provider.provider} пока не поддерживает генерацию через этот endpoint`, "GENERATION_PROVIDER_UNSUPPORTED");
  } finally {
    clearTimeout(timeout);
  }
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

// ─── Stream operations ───

export function getStreamOperation(operationId: string): StreamOperation | undefined {
  return streamStore.get(operationId);
}

export function cleanupStreamOperation(operationId: string): void {
  streamStore.delete(operationId);
}

// ─── Generated posts CRUD ───

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
        .where(
          and(
            ...conditions,
            sql`${generatedPosts.createdAt} < ${new Date(decoded.sortValue)}`
          )
        )
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
  await db
    .delete(generatedPosts)
    .where(and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)));
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
