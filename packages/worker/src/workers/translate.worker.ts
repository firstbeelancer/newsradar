/**
 * ------------------------------------------------------------------
 * Worker: translate
 * ------------------------------------------------------------------
 * Detects article language and translates to Russian if needed.
 * After translation, queues for ingest-analysis.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { articles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  buildTitleOnlyPreview,
  detectLanguage,
  ensureRussianHeadline,
  translateArticle,
} from "../lib/translator.js";
import { fetchArticleText } from "../lib/article-extractor.js";
import { setAiTelemetryError } from "../lib/ai-client.js";
import { ingestAnalysisQueue } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface TranslateJob {
  articleId: string;
  force?: boolean;
}

/**
 * After this many failed attempts the article stops being re-queued.
 *
 * Without a ceiling, a permanently untranslatable article (dead provider,
 * paywalled body, unsupported language) was reset to needs_translation=true on
 * every failure and picked up again by the heartbeat requeue a minute later —
 * forever. It never reached the feed, and the status bar showed a translation
 * backlog that could never drain.
 */
export const MAX_TRANSLATION_ATTEMPTS = 5;

/**
 * Process a translate job.
 */
export async function processTranslate(
  job: Job<TranslateJob>,
  logger: Logger
): Promise<{
  translated: boolean;
  originalLanguage: string;
}> {
  const { articleId } = job.data;
  const force = job.data.force === true;

  logger.debug({ articleId, jobId: job.id }, "Processing translation");

  // Load article
  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      content: articles.content,
      aiSummary: articles.aiSummary,
      link: articles.link,
      workspaceId: articles.workspaceId,
      originalTitle: articles.originalTitle,
      originalDescription: articles.originalDescription,
      language: articles.language,
      translationAttempts: articles.translationAttempts,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Detect language from content
  const sourceTitle = force ? article.originalTitle ?? article.title : article.title;
  const sourceDescription = force ? article.originalDescription ?? article.description : article.description;
  const sourceContent = force && article.language === "ru"
    ? article.originalDescription ?? ""
    : article.content ?? (force ? await fetchArticleText(article.link) : "");
  const titleLang = detectLanguage(sourceTitle);
  const sourceBody = sourceDescription ?? sourceContent;
  const bodyLang = sourceBody ? detectLanguage(sourceBody) : "ru";
  const detectedLang = titleLang === "ru"
    ? bodyLang
    : titleLang === "unknown" && bodyLang !== "ru"
      ? bodyLang
      : titleLang;

  // Skip only when both visible fields are already Russian. Stored language
  // metadata is not trusted here because older pipeline versions marked some
  // untranslated rows as language=ru.
  if (!force && titleLang === "ru" && bodyLang === "ru") {
    await db
      .update(articles)
      .set({
        language: "ru",
        detectedLang: "ru",
        needsTranslation: false,
        status: "translated",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    await ingestAnalysisQueue.add(
      `ingest-analysis-${articleId}`,
      { articleId },
      { jobId: `ingest-analysis-${articleId}` }
    );

    logger.debug({ articleId }, "Article is already Russian, skipping translation");
    return { translated: false, originalLanguage: "ru" };
  }

  // Save original fields before translation
  const originalTitle = article.originalTitle ?? article.title;
  const originalDescription = article.originalDescription ?? article.description;

  // Translate to Russian
  logger.info({ articleId, from: detectedLang }, "Translating article to Russian");

  try {
    const translated = await translateArticle(
      sourceTitle,
      sourceDescription ?? undefined,
      sourceContent ?? undefined,
      article.workspaceId
    );

    await db
      .update(articles)
      .set({
        title: translated.title,
        description: translated.description,
        content: translated.content || null,
        aiSummary: translated.aiSummary || translated.description || null,
        originalTitle: originalTitle,
        originalDescription: originalDescription,
        language: "ru",
        detectedLang: detectedLang,
        needsTranslation: false,
        status: "translated",
        translationAttempts: 0,
        translationError: translated.degraded ? translated.degradedReason ?? null : null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    await ingestAnalysisQueue.add(
      `ingest-analysis-${articleId}`,
      { articleId },
      { jobId: `ingest-analysis-${articleId}` }
    );

    if (translated.degraded) {
      logger.warn(
        { articleId, from: detectedLang, reason: translated.degradedReason },
        "Article translated with degraded fallback"
      );
    } else {
      logger.info({ articleId, from: detectedLang }, "Article translated successfully");
    }

    return { translated: true, originalLanguage: detectedLang };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const attempts = (article.translationAttempts ?? 0) + 1;
    setAiTelemetryError(`Translation pipeline failure: ${errorMessage}`);

    if (attempts >= MAX_TRANSLATION_ATTEMPTS) {
      // Give up. The article leaves the translation backlog with a Russian
      // headline built from whatever survived, so the feed stops showing an
      // eternal "Перевод…" badge and the status bar can actually drain.
      // The original text is preserved, so a manual re-translate still works.
      const salvagedTitle = ensureRussianHeadline("", originalTitle ?? article.title);
      const salvagedSummary = buildTitleOnlyPreview(salvagedTitle);

      await db
        .update(articles)
        .set({
          title: salvagedTitle,
          description: salvagedSummary,
          aiSummary: salvagedSummary,
          content: null,
          originalTitle: originalTitle,
          originalDescription: originalDescription,
          language: "ru",
          detectedLang: detectedLang,
          needsTranslation: false,
          status: "translated",
          translationAttempts: attempts,
          translationError: errorMessage.slice(0, 1_000),
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      // Still push it through scoring so it is ranked like any other article.
      await ingestAnalysisQueue.add(
        `ingest-analysis-${articleId}`,
        { articleId },
        { jobId: `ingest-analysis-${articleId}` }
      );

      logger.error(
        { articleId, err: errorMessage, attempts },
        "Translation permanently failed — releasing article with fallback headline"
      );

      // Resolved, not thrown: the article is in a terminal state now, and a
      // BullMQ failure here would only add noise to the queue health view.
      return { translated: false, originalLanguage: detectedLang };
    }

    logger.error(
      { articleId, err: errorMessage, attempts },
      "Translation failed — keeping article pending and retrying"
    );

    // Keep article in pre-translation state so the feed can show "Перевод…"
    // and BullMQ can retry. Do NOT mark status=translated on failure —
    // that previously leaked Chinese/English titles into the ready feed.
    await db
      .update(articles)
      .set({
        originalTitle: originalTitle,
        originalDescription: originalDescription,
        language: detectedLang,
        detectedLang: detectedLang,
        needsTranslation: true,
        status: "fetched",
        translationAttempts: attempts,
        translationError: errorMessage.slice(0, 1_000),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    // Rethrow so BullMQ applies attempts/backoff instead of silently "succeeding".
    throw err instanceof Error ? err : new Error(errorMessage);
  }
}
