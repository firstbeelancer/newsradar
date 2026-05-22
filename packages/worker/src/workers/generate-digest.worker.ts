/**
 * ------------------------------------------------------------------
 * Worker: generate-digest
 * ------------------------------------------------------------------
 * Collects top-scored articles for an agent over a period,
 * generates a digest via AI, streams progress via Redis pub/sub,
 * saves result in generated_posts.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import {
  articles,
  contentTemplates,
  generatedPosts,
  agents,
  workspaces,
} from "../db/schema.js";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { streamComplete, complete } from "../lib/ai-client.js";
import { redis } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface GenerateDigestJob {
  agentId: string;
  templateId?: string;
  operationId: string;
  workspaceId: string;
  period?: "day" | "week";
}

/**
 * Publish generation progress to Redis pub/sub for SSE.
 */
async function publishProgress(
  operationId: string,
  data: {
    status: "pending" | "generating" | "completed" | "error";
    content?: string;
    chunk?: string;
    error?: string;
  }
): Promise<void> {
  const channel = `newsradar:generation:${operationId}`;
  await redis.publish(channel, JSON.stringify({ ...data, timestamp: Date.now() }));
}

/**
 * Process a generate-digest job.
 */
export async function processGenerateDigest(
  job: Job<GenerateDigestJob>,
  logger: Logger
): Promise<{ postId: string; content: string; articleCount: number }> {
  const { agentId, templateId, operationId, workspaceId, period = "day" } = job.data;

  logger.info({ operationId, agentId, period }, "Generating digest");

  await publishProgress(operationId, { status: "pending" });

  // Verify agent exists
  const agentResult = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)))
    .limit(1);

  const agent = agentResult[0];
  if (!agent) {
    const error = `Agent not found: ${agentId}`;
    await publishProgress(operationId, { status: "error", error });
    throw new Error(error);
  }

  // Resolve template
  let template: typeof contentTemplates.$inferSelect | undefined;
  if (templateId) {
    const templateResult = await db
      .select()
      .from(contentTemplates)
      .where(
        and(
          eq(contentTemplates.id, templateId),
          eq(contentTemplates.workspaceId, workspaceId)
        )
      )
      .limit(1);
    template = templateResult[0];
  }

  // Find default digest template if none specified
  if (!template) {
    const defaultResult = await db
      .select()
      .from(contentTemplates)
      .where(
        and(
          eq(contentTemplates.workspaceId, workspaceId),
          eq(contentTemplates.type, "digest"),
          eq(contentTemplates.isDefault, true)
        )
      )
      .limit(1);
    template = defaultResult[0];
  }

  // Calculate period start
  const periodStart = new Date();
  if (period === "week") {
    periodStart.setDate(periodStart.getDate() - 7);
  } else {
    periodStart.setDate(periodStart.getDate() - 1);
  }

  // Fetch top-scored articles for the agent in the period
  const selectedArticles = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.workspaceId, workspaceId),
        eq(articles.agentId, agentId),
        eq(articles.status, "scored"),
        gte(articles.createdAt, periodStart)
      )
    )
    .orderBy(desc(articles.score), desc(articles.publishedAt))
    .limit(20);

  if (selectedArticles.length === 0) {
    logger.warn({ agentId, period }, "No articles found for digest");

    // Save empty digest
    const [post] = await db
      .insert(generatedPosts)
      .values({
        workspaceId,
        agentId,
        templateId: template?.id ?? null,
        type: "digest",
        title: `Дайджест: ${agent.name} — нет материалов`,
        content: `За выбранный период (${period === "day" ? "день" : "неделя"}) не найдено подходящих статей для агента "${agent.name}".`,
        articleCount: 0,
        articlesSnapshot: [],
        promptSnapshot: "",
        modelSnapshot: "platform-ai",
      })
      .returning();

    await publishProgress(operationId, { status: "completed", content: post.content });

    return { postId: post.id, content: post.content, articleCount: 0 };
  }

  // Build article texts
  const articleTexts = selectedArticles.map((a, i) => {
    let text = `[${i + 1}] ${a.title}`;
    if (a.description) text += `\n${a.description}`;
    if (a.aiSummary) text += `\nAI Summary: ${a.aiSummary}`;
    text += `\nScore: ${a.score}`;
    return text;
  });

  const content = articleTexts.join("\n\n---\n\n");

  // Fetch workspace-level prompts as fallback before hardcoded defaults
  const workspaceResult = await db
    .select({ config: workspaces.config })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const workspacePrompts = (workspaceResult[0]?.config as Record<string, unknown> | undefined)?.prompts as
    | { post_generation?: string; digest_generation?: string }
    | undefined;

  const defaultSystemPrompt =
    workspacePrompts?.digest_generation ??
    "Ты — профессиональный аналитик новостей. Подготовь структурированный дайджест на основе предоставленных статей. Пиши на русском языке. Группируй новости по темам и значимости. Для каждой темы: краткое резюме + ключевые факты + вывод. Избегай дублирования. Добавляй аналитический контекст и прогнозы.";

  const defaultUserPrompt =
    `На основе следующих статей создай ${period === "day" ? "дневной" : "недельный"} дайджест:\n\n${content}`;

  const systemPrompt = template?.systemPrompt ?? defaultSystemPrompt;
  const userPrompt =
    template?.userPrompt?.replace(/\{\{content\}\}/g, content) ?? defaultUserPrompt;

  await publishProgress(operationId, { status: "generating" });

  // Generate with streaming
  let fullContent = "";

  try {
    fullContent = await streamComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      workspaceId,
      process: "generation",
      temperature: 0.7,
      maxTokens: 4_000,
      onChunk: async (chunk) => {
        fullContent += chunk;
        await publishProgress(operationId, {
          status: "generating",
          chunk,
          content: fullContent,
        });
      },
    });
  } catch (err) {
    logger.warn({ operationId, err: (err as Error).message }, "Streaming failed, using fallback");
    fullContent = await complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      workspaceId,
      process: "generation",
      temperature: 0.7,
      maxTokens: 4_000,
    });
  }

  // Save generated digest
  const [post] = await db
    .insert(generatedPosts)
    .values({
      workspaceId,
      agentId,
      templateId: template?.id ?? null,
      type: "digest",
      title: `Дайджест: ${agent.name}`,
      content: fullContent,
      articleCount: selectedArticles.length,
      articlesSnapshot: selectedArticles.map((a) => ({
        id: a.id,
        title: a.title,
        link: a.link,
        score: a.score,
      })),
      promptSnapshot: userPrompt,
      modelSnapshot: "platform-ai",
    })
    .returning();

  await publishProgress(operationId, {
    status: "completed",
    content: fullContent,
  });

  logger.info(
    {
      operationId,
      postId: post.id,
      articleCount: selectedArticles.length,
      contentLength: fullContent.length,
    },
    "Digest generated successfully"
  );

  return {
    postId: post.id,
    content: fullContent,
    articleCount: selectedArticles.length,
  };
}
