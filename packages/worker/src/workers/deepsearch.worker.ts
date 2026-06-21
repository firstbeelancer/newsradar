import { and, desc, eq, ne } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Logger } from "pino";
import { db } from "../db/index.js";
import { articles, deepsearchResults, operationLogs, workspaces } from "../db/schema.js";
import { complete } from "../lib/ai-client.js";
import { fetchArticleText } from "../lib/article-extractor.js";
import { decrypt } from "../lib/encryption.js";
import { runWebSearch, type WebSearchProvider, type WebSearchSettings, type WebSearchSource } from "../lib/web-search.js";

export interface DeepsearchJob {
  resultId: string;
  operationLogId: string;
  userId: string;
  workspaceId: string;
  agentId: string;
  articleId: string;
  customPrompt?: string;
}

interface StoredDeepsearchWebSearchSettings {
  provider?: WebSearchProvider;
  apiKeyEncrypted?: string;
  baseUrl?: string;
  model?: string;
  maxResults?: number;
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

function readWebSearchSettings(config: unknown): WebSearchSettings {
  const root = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const stored = (root.deepsearchWebSearch && typeof root.deepsearchWebSearch === "object"
    ? root.deepsearchWebSearch
    : {}) as StoredDeepsearchWebSearchSettings;

  let apiKey: string | undefined;
  if (stored.apiKeyEncrypted) {
    try {
      apiKey = decrypt(stored.apiKeyEncrypted);
    } catch {
      apiKey = undefined;
    }
  }

  return {
    provider: stored.provider ?? "disabled",
    apiKey,
    baseUrl: stored.baseUrl,
    model: stored.model,
    maxResults: stored.maxResults,
  };
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

function buildRelatedBlock(
  related: Array<Pick<typeof articles.$inferSelect, "id" | "title" | "description" | "aiSummary" | "link" | "score">>
): string {
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

function buildExternalSourcesBlock(sources: WebSearchSource[]): string {
  if (sources.length === 0) {
    return "External web search is disabled or returned no sources.";
  }

  return sources
    .map((source, index) =>
      [
        `${index + 1}. ${source.title}`,
        source.snippet ? `Context: ${compactText(source.snippet, 700)}` : null,
        `URL: ${source.url}`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function buildSearchQuery(article: typeof articles.$inferSelect): string {
  const title = article.title.length < 180 ? `"${article.title}"` : article.title;
  const description = compactText(article.description ?? article.aiSummary, 180);
  return [title, description].filter(Boolean).join(" ");
}

function formatDeepSearchError(err: unknown): string {
  const message = err instanceof Error ? err.message : "DeepSearch failed";
  if (message === "This operation was aborted" || message.toLowerCase().includes("aborted")) {
    return "DeepSearch не уложился в лимит 120 секунд. Попробуй повторить позже или уменьшить число внешних источников в настройках DeepSearch.";
  }
  return message;
}

function buildDeepSearchPrompt(params: {
  article: typeof articles.$inferSelect;
  fetchedText: string;
  related: Array<Pick<typeof articles.$inferSelect, "id" | "title" | "description" | "aiSummary" | "link" | "score">>;
  externalSources: WebSearchSource[];
  webSearchProvider: WebSearchProvider;
  webSearchError?: string;
  customPrompt?: string;
}): string {
  const editorRequest = params.customPrompt?.trim()
    ? `\n\nAdditional editor request:\n${params.customPrompt.trim()}`
    : "";

  const webSearchStatus = params.webSearchError
    ? `External web search error: ${params.webSearchError}`
    : `External web search provider: ${params.webSearchProvider}`;

  return `Run DeepSearch for this news item in Russian.

Use the article data, fetched page text, related local feed items, and external sources below. If source data is thin or external search is unavailable, say what is missing instead of inventing facts.

Main article:
${buildArticleBlock(params.article, params.fetchedText)}

Related local articles:
${buildRelatedBlock(params.related)}

${webSearchStatus}
External sources:
${buildExternalSourcesBlock(params.externalSources)}
${editorRequest}

Return an analytical research report with these sections:
1. Что произошло.
2. Почему это важно.
3. Ключевые сущности и факты.
4. Кросс-проверка по локальной базе и внешним источникам.
5. Что говорят другие источники и где есть расхождения.
6. Насколько широко история разошлась по сети.
7. Что может быть дальше.
8. Что проверить редактору.
9. Источники.
10. Короткий вывод.

Do not write a Telegram post. Do not add hashtags. Keep source URLs visible. Base the final opinion on the original article, local database context, and external sources when they are available.`;
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
    message: "DeepSearch анализирует статью и ищет внешние источники",
  });

  try {
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId)),
    });

    if (!article) {
      throw new Error("Article not found for DeepSearch");
    }

    const [fetchedText, related, workspace] = await Promise.all([
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
      db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) }),
    ]);

    const webSearchSettings = readWebSearchSettings(workspace?.config);
    let externalSources: WebSearchSource[] = [];
    let webSearchError: string | undefined;

    try {
      externalSources = await runWebSearch(buildSearchQuery(article), webSearchSettings);
    } catch (err) {
      webSearchError = err instanceof Error ? err.message : "External web search failed";
      logger.warn({ resultId, articleId, err: webSearchError }, "DeepSearch external web search failed");
    }

    const externalSourcesWithText = await Promise.all(
      externalSources.map(async (source) => ({
        ...source,
        snippet: compactText([source.snippet, await fetchArticleText(source.url)].filter(Boolean).join(" "), 1_600),
      }))
    );

    const prompt = buildDeepSearchPrompt({
      article,
      fetchedText,
      related,
      externalSources: externalSourcesWithText,
      webSearchProvider: webSearchSettings.provider,
      webSearchError,
      customPrompt,
    });

    let resolvedProviderInfo: { provider: string; model: string; baseUrl: string; source: string } | undefined;
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
      onProviderResolved: (info) => {
        resolvedProviderInfo = info;
        logger.info(
          {
            resultId,
            articleId,
            process: "deepsearch",
            provider: info.provider,
            model: info.model,
            source: info.source,
          },
          "DeepSearch AI provider resolved",
        );
      },
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
      externalSources: externalSourcesWithText,
      externalSourceCount: externalSourcesWithText.length,
      webSearchProvider: webSearchSettings.provider,
      webSearchError,
      aiProvider: resolvedProviderInfo?.provider ?? null,
      aiModel: resolvedProviderInfo?.model ?? null,
      aiProviderSource: resolvedProviderInfo?.source ?? null,
      promptVersion: "deepsearch-worker-v2-web-search",
    };

    await db
      .update(deepsearchResults)
      .set({
        status: "completed",
        findings,
        reportText,
        finishedAt,
        completedAt: finishedAt,
        updatedAt: finishedAt,
      })
      .where(and(eq(deepsearchResults.id, resultId), eq(deepsearchResults.workspaceId, workspaceId)));

    await updateOperationLog(operationLogId, {
      status: webSearchError ? "warning" : "success",
      message: webSearchError
        ? `DeepSearch завершен с предупреждением: внешний поиск не сработал (${webSearchError})`
        : "DeepSearch завершен",
      finishedAt,
      metadata: {
        resultId,
        articleId,
        relatedArticleIds: related.map((item) => item.id),
        externalSourceCount: externalSourcesWithText.length,
        webSearchProvider: webSearchSettings.provider,
        webSearchError,
        aiProvider: resolvedProviderInfo?.provider ?? null,
        aiModel: resolvedProviderInfo?.model ?? null,
        aiProviderSource: resolvedProviderInfo?.source ?? null,
        preview: reportText.slice(0, 280),
      },
    });

    logger.info({ resultId, articleId }, "DeepSearch worker completed");
    return { resultId, status: "completed" };
  } catch (err) {
    const error = formatDeepSearchError(err);
    const finishedAt = new Date();

    await db
      .update(deepsearchResults)
      .set({
        status: "failed",
        error,
        errorMessage: error,
        finishedAt,
        failedAt: finishedAt,
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
