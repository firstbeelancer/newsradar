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
import { ingestAnalysisQueue } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface TranslateJob {
  articleId: string;
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

  logger.debug({ articleId, jobId: job.id }, "Processing translation");

  // Load article
  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
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
  const detectedLang = detectLanguage(article.title);

  // If already Russian or detection says Russian, skip translation
  if (detectedLang === "ru" || article.language === "ru") {
    await db
      .update(articles)
      .set({
        language: "ru",
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

  // Translate to Russian
  logger.info({ articleId, from: detectedLang }, "Translating article to Russian");

  try {
    const translated = await translateArticle(
      article.title,
      article.description ?? undefined
    );

    await db
      .update(articles)
      .set({
        title: translated.title,
        description: translated.description,
        language: "ru",
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
    logger.error({ articleId, err: errorMessage }, "Translation failed");

    // Even on failure, continue pipeline with original text
    await db
      .update(articles)
      .set({
        language: detectedLang,
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
