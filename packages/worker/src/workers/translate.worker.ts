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
import { detectLanguage, translateArticle } from "../lib/translator.js";
import { setAiTelemetryError } from "../lib/ai-client.js";
import { ingestAnalysisQueue } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface TranslateJob {
  articleId: string;
  force?: boolean;
}

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
      originalTitle: articles.originalTitle,
      originalDescription: articles.originalDescription,
      language: articles.language,
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
  const sourceContent = article.content;
  const detectedLang = detectLanguage(sourceTitle);

  // If already Russian or detection says Russian, skip translation
  if (!force && (detectedLang === "ru" || article.language === "ru")) {
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
      sourceContent ?? undefined
    );

    await db
      .update(articles)
      .set({
        title: translated.title,
        description: translated.description,
        content: translated.content || null,
        originalTitle: originalTitle,
        originalDescription: originalDescription,
        language: "ru",
        detectedLang: detectedLang,
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

    logger.info({ articleId, from: detectedLang }, "Article translated successfully");

    return { translated: true, originalLanguage: detectedLang };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    setAiTelemetryError(`Translation pipeline fallback: ${errorMessage}`);
    logger.error({ articleId, err: errorMessage }, "Translation failed");

    // Even on failure, continue pipeline with original text
    await db
      .update(articles)
      .set({
        language: detectedLang,
        detectedLang: detectedLang,
        needsTranslation: true,
        originalTitle: originalTitle,
        originalDescription: originalDescription,
        status: "translated",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    await ingestAnalysisQueue.add(
      `ingest-analysis-${articleId}`,
      { articleId },
      { jobId: `ingest-analysis-${articleId}` }
    );

    return { translated: false, originalLanguage: detectedLang };
  }
}
