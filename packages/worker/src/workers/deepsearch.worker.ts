import { and, desc, eq, ne } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Logger } from "pino";
import { db } from "../db/index.js";
import { articles, deepsearchResults, operationLogs } from "../db/schema.js";
import { complete } from "../lib/ai-client.js";
import { fetchArticleText } from "../lib/article-extractor.js";

export interface DeepsearchJob {
  resultId: string;
  operationLogId: string;
  userId: string;
  workspaceId: string;
  agentId: string;
  articleId: string;
  customPrompt?: string;
}

async function updateOperationLog(
  operationLogId: string,
  data: { status: string; message?: string; finishedAt?: Date; metadata?: Record<string, unknown> }
): Promise<void> {
  await db.update(operationLogs).set(data).where(eq(operationLogs.id, operationLogId));
}

function compactText(value: string | null | undefined, limit: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function buildArticleBlock(article: typeof articles.$inferSelect, fetchedText: string): string {
  return [
    `Title: ${article.title}`,
    article.description ? `Description: ${compactText(article.description, 1_500)}` : null,
    article.aiSummary ? `Existing summary: ${compactText(article.aiSummary, 1_500)}` : null,
    article.content ? `Stored content: ${compactText(article.content, 4_000)}` : null,
    fetchedText ? `Fetched page text: ${compactText(fetchedText, 6_000)}` : null,
    article.link ? `Original URL: ${article.link}` : null,
    article.publishedAt ? `Published at: ${article.publishedAt.toISOString()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRelatedBlock(related: Array<Pick<typeof articles.$inferSelect, "id" | "title" | "description" | "aiSummary" | "link" | "score">>): string {
  if (related.length === 0) return "No related articles in the local feed.";

  return related
    .map((article, index) =>
      [
        `${index + 1}. ${article.title}`,
        article.description || article.aiSummary ? `Context: ${compactText(article.description ?? article.aiSummary, 450)}` : null,
        article.score != null ? `Score: ${article.score}` : null,
        article.link ? `URL: ${article.link}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function buildDeepSearchPrompt(params: {
  article: typeof articles.$inferSelect;
  fetchedText: string;
  related: Array<Pick<typeof articles.$inferSelect, "id" | "title" | "description" | "aiSummary" | "link" | "score">>;
  customPrompt?: string;
}): string {
  const editorRequest = params.customPrompt?.trim()
    ? `\n\nAdditional editor request:\n${params.customPrompt.trim()}`
    : "";

  return `Run DeepSearch for this news item in Russian.

Use only the provided article data, fetched page text, and related local feed items. If the source data is thin, say what is missing instead of inventing facts.

Main article:
${buildArticleBlock(params.article, params.fetchedText)}

Related local articles:
${buildRelatedBlock(params.related)}
${editorRequest}

Return a concise research report with these sections:
1. Что произошло.
2. Почему это важно.
3. Контекст и связанные сигналы.
4. Что может быть дальше.
5. Что проверить редактору.
6. Короткий вывод.

Do not write a Telegram post. Do not add hashtags. Keep source URLs visible when they help verify the report.`;
}

export async function processDeepsearch(
  job: Job<DeepsearchJob>,
  logger: Logger
): Promise<{ resultId: string; status: "completed" }> {
  const { resultId, operationLogId, workspaceId, agentId, articleId, customPrompt } = job.data;
  const startedAt = new Date();

  logger.info({ resultId, articleId }, "DeepSearch worker started");

  await db
    .update(deepsearchResults)
    .set({ status: "running", startedAt, updatedAt: startedAt })
    .where(and(eq(deepsearchResults.id, resultId), eq(deepsearchResults.workspaceId, workspaceId)));

  await updateOperationLog(operationLogId, {
    status: "running",
    message: "DeepSearch анализирует статью",
  });

  try {
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId)),
    });

    if (!article) {
      throw new Error("Article not found for DeepSearch");
    }

    const [fetchedText, related] = await Promise.all([
      fetchArticleText(article.link),
      db
        .select({
          id: articles.id,
          title: articles.title,
          description: articles.description,
          aiSummary: articles.aiSummary,
          link: articles.link,
          score: articles.score,
        })
        .from(articles)
        .where(and(eq(articles.workspaceId, workspaceId), eq(articles.agentId, agentId), ne(articles.id, articleId)))
        .orderBy(desc(articles.score), desc(articles.createdAt))
        .limit(5),
    ]);

    const prompt = buildDeepSearchPrompt({ article, fetchedText, related, customPrompt });
    const reportText = (await complete({
      workspaceId,
      process: "deepsearch",
      temperature: 0.35,
      maxTokens: 6_000,
      messages: [
        {
          role: "system",
          content:
            "You are Newsradar DeepSearch: a careful Russian-language research analyst. Produce an analytical report, not a social post.",
        },
        { role: "user", content: prompt },
      ],
    })).trim();

    if (!reportText) {
      throw new Error("AI provider returned an empty DeepSearch report");
    }

    const finishedAt = new Date();
    const findings = {
      articleId,
      articleTitle: article.title,
      articleUrl: article.link,
      fetchedTextChars: fetchedText.length,
      relatedArticleIds: related.map((item) => item.id),
      promptVersion: "deepsearch-worker-v1",
    };

    await db
      .update(deepsearchResults)
      .set({
        status: "completed",
        findings,
        reportText,
        finishedAt,
        updatedAt: finishedAt,
      })
      .where(and(eq(deepsearchResults.id, resultId), eq(deepsearchResults.workspaceId, workspaceId)));

    await updateOperationLog(operationLogId, {
      status: "success",
      message: "DeepSearch завершен",
      finishedAt,
      metadata: {
        resultId,
        articleId,
        relatedArticleIds: related.map((item) => item.id),
        preview: reportText.slice(0, 280),
      },
    });

    logger.info({ resultId, articleId }, "DeepSearch worker completed");
    return { resultId, status: "completed" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "DeepSearch failed";
    const finishedAt = new Date();

    await db
      .update(deepsearchResults)
      .set({
        status: "failed",
        error,
        finishedAt,
        updatedAt: finishedAt,
      })
      .where(and(eq(deepsearchResults.id, resultId), eq(deepsearchResults.workspaceId, workspaceId)));

    await updateOperationLog(operationLogId, {
      status: "failed",
      message: error,
      finishedAt,
      metadata: { resultId, articleId },
    });

    logger.error({ resultId, articleId, err: error }, "DeepSearch worker failed");
    throw err;
  }
}
