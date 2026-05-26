import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, contentTemplates, generatedPosts, workspaces } from "../../db/schema.js";
import type { GeneratedPost } from "../../db/types.js";
import { AppError } from "../../middleware/error-handler.js";
import { decodeCursor, encodeCursor } from "../../lib/pagination.js";
import type { Cursor, PaginatedResult } from "../../lib/pagination.js";
import { createOperationLog } from "../operation-logs/service.js";
import { getDefaultEmojiItems, type EmojiPromptItem } from "../asset-packs/service.js";
import { resolveProviderForProcess } from "../ai-providers/service.js";
import { getGenerateDigestQueue, getGeneratePostQueue } from "../../lib/queues.js";
import { setGenerationState } from "./progress.js";
import {
  buildArticleContent,
  buildCompactArticleContext,
  getGenerationCutoffDate,
  renderPromptTemplate,
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
  if (selectedArticles.length === 0) {
    throw new AppError(400, "\u0414\u043b\u044f \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u043d\u0443\u0436\u043d\u0430 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u0430 \u0441\u0442\u0430\u0442\u044c\u044f", "GENERATION_ARTICLES_REQUIRED");
  }

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

  const emojiItems = await getDefaultEmojiItems(workspaceId);
  const emojiPack = emojiItems.map((item) => item.value);
  const systemPrompt = buildTelegramSystemPrompt(template?.systemPrompt ?? defaultSystemPrompt, type, emojiItems);
  const baseUserPrompt =
    renderPromptTemplate(template?.userPrompt, selectedArticles)
    ?? `На основе следующих статей создай ${type === "digest" ? "дайджест" : "пост"}:\n\n${articleTexts}`;
  const effectiveBaseUserPrompt = isRegenerationPrompt(customPrompt)
    ? buildRegenerationBasePrompt(selectedArticles)
    : baseUserPrompt;
  const userPrompt = buildGenerationUserPrompt(effectiveBaseUserPrompt, customPrompt);

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

  await setGenerationState(operationId, {
    status: "pending",
    content: "",
    chunks: [],
  });

  const jobData = {
    operationId,
    operationLogId: operationLog.id,
    userId,
    workspaceId,
    agentId,
    templateId: template?.id ?? null,
    articleIds: selectedArticles.map((article) => article.id),
    articleCount: selectedArticles.length,
    type,
    systemPrompt,
    userPrompt,
    requestedProvider,
    requestedModel: provider?.model ?? requestedModel,
    emojiPack,
    allowHashtags: wantsHashtags(customPrompt),
    title: selectedArticles[0]?.title ?? "Generated post",
    articlesSnapshot: selectedArticles.map((article) => ({
      id: article.id,
      title: article.title,
      link: article.link,
      score: article.score,
    })),
  };

  const queue = type === "digest" ? getGenerateDigestQueue() : getGeneratePostQueue();
  await queue.add(`${type}-${operationId}`, jobData, {
    jobId: operationId,
    removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
    removeOnFail: { age: 60 * 60 * 24 * 7, count: 1000 },
  });

  return { operationId, status: "queued" };
}
function isRegenerationPrompt(customPrompt?: string): boolean {
  return /Current generated draft to revise:/i.test(customPrompt ?? "");
}

function buildRegenerationBasePrompt(selectedArticles: typeof articles.$inferSelect[]): string {
  return [
    "Use this compact source context while revising the existing draft.",
    "If the editor asks for the original link, attach the exact Original URL from this context.",
    "If the editor asks for tags or hashtags, add concise relevant hashtags at the end in #tag format.",
    "",
    buildCompactArticleContext(selectedArticles),
  ].join("\n");
}

function buildGenerationUserPrompt(basePrompt: string, customPrompt?: string): string {
  const feedback = customPrompt?.trim();
  if (!feedback) return basePrompt;
  const tagInstruction = wantsHashtags(feedback)
    ? "\nThe editor asked for tags. Add 3-6 relevant hashtags at the end, each starting with #."
    : "";

  return `${basePrompt}\n\nMANDATORY EDITOR FEEDBACK:\n${feedback}${tagInstruction}\n\nApply every editor instruction above explicitly. If feedback asks for tags, links, source mentions, structure, or a changed tone, include those changes in the new version.`;
}

function wantsHashtags(customPrompt?: string): boolean {
  const normalized = customPrompt?.toLowerCase() ?? "";
  if (/#|\btags?\b|хештег|хэштег|hashtag|hashtags|теги|тегов|тегами/.test(normalized)) {
    return true;
  }
  return /#|хештег|хэштег|hashtag|hashtags|теги|тегов|тегами/.test(normalized);
}

function describeEmoji(item: EmojiPromptItem): string {
  const semanticByName: Record<string, string> = {
    breaking: "urgent or breaking news",
    hot: "hot trend or strong public attention",
    insight: "analysis, reasoning, model behavior, expert context",
    important: "important point, key takeaway, editor note",
    stats: "numbers, metrics, charts, research data",
    watch: "something to monitor",
    action: "fast action, launch, practical step",
    done: "confirmed result, completion, positive outcome",
    news: "neutral news item",
    search: "research, verification, DeepSearch",
    warning: "risk, warning, uncertainty",
    security: "security, privacy, protection, vulnerabilities",
    bug: "bug, exploit, incident, technical failure",
    lock: "access, credentials, closed systems, safety",
    key: "key fact, access, security key, unlock",
    robot: "AI agents, automation, robotics",
    rocket: "launch, fast growth, ambitious release",
    tools: "tools, engineering, implementation",
    chart_up: "growth, increase, market rise",
    chart_down: "decline, reduction, market drop",
    money: "business, funding, revenue, prices",
    idea: "idea, hypothesis, creative angle",
    target: "goal, audience, targeting, focus",
    link: "source link, reference, connection",
    world: "global context, international news",
    time: "deadline, timing, schedule",
    spark: "notable detail, creative accent",
    question: "open question, uncertainty",
    memo: "note, checklist, document",
    folder: "archive, dataset, collection",
    mail: "communication, email, outreach",
    megaphone: "announcement, PR, public statement",
    pin: "location, pinned point, important marker",
    star: "highlight, quality, leader",
    trophy: "achievement, award, benchmark win",
    health: "medicine, health, wellbeing",
    science: "science, research, experiment",
    design: "design, art, visual work",
    construction: "building, infrastructure, work in progress",
    calendar: "date, event, schedule",
  };

  return semanticByName[item.name] ?? item.label ?? "custom emoji; use only when its symbol clearly fits the meaning";
}

function buildEmojiGuide(items: EmojiPromptItem[]): string {
  if (items.length === 0) return "- 📰 (news): neutral news item";
  return items
    .map((item) => {
      const label = item.label && item.label !== item.value ? `, ${item.label}` : "";
      return `- ${item.value} (${item.name}${label}): ${describeEmoji(item)}`;
    })
    .join("\n");
}

function buildTelegramSystemPrompt(basePrompt: string, type: GeneratePostInput["type"], emojiItems: EmojiPromptItem[]): string {
  const emojiList = emojiItems.map((item) => item.value).join(" ");
  const emojiGuide = buildEmojiGuide(emojiItems);

  return `${basePrompt}

ФОРМАТ ВЫВОДА:
- Верни один готовый текст для Telegram.
- Не используй Markdown: никаких #, **, *, __, \`\`\`, обратных кавычек.
- Не используй хештеги, если их явно не попросили.
- Пиши короткими абзацами, живо и по делу.
- Используй эмодзи только из этого набора: ${emojiList || "🚨 🔥 🧠 📌 📊 👀 ⚡ ✅"}.
- Итог должен быть сразу пригоден для копирования и отправки без ручной чистки.

EMOJI MEANING MAP:
${emojiGuide}

Emoji selection rule: choose emoji by meaning from the map above, not by list order. Do not keep reusing the first emojis unless they are semantically correct.

${type === "digest"
    ? "Для дайджеста сгруппируй материалы по смыслу и оставь только самое важное."
    : "Для поста сделай сильный заход, затем 2-4 коротких абзаца по сути и финальный вывод."}`.trim();
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
