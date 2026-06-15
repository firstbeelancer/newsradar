/**
 * ------------------------------------------------------------------
 * Worker: cleanup
 * ------------------------------------------------------------------
 * Daily cron job that:
 *   1. Deletes articles older than 3 days that are NOT favorited
 *   2. Deletes old generated posts (> 30 days)
 *   3. Deletes old operation logs (> 7 days)
 *   4. Updates workspace counters
 * ------------------------------------------------------------------
 */

import { db, executeRaw } from "../db/index.js";
import { articles, favoriteArticles, generatedPosts, operationLogs } from "../db/schema.js";
import { sql, lt, and, eq } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface CleanupJob {
  /** If provided, only clean this workspace. Otherwise global cleanup. */
  workspaceId?: string;
}

/**
 * Process a cleanup job.
 */
export async function processCleanup(
  job: Job<CleanupJob>,
  logger: Logger
): Promise<{
  deletedArticles: number;
  deletedPosts: number;
  deletedLogs: number;
}> {
  logger.info({ jobId: job.id }, "Running cleanup");

  const now = new Date();

  // 1. Delete articles older than 3 days that are NOT favorited.
  //    The TZ says «Новости хранятся 3 дня, затем удаляются, кроме избранных».
  //    Apply the threshold to *publishedAt* when known, otherwise fall back to
  //    createdAt. This way freshly-imported articles that never made it through
  //    the pipeline (stuck in 'fetched' / 'translated') are also cleaned up
  //    instead of leaking in the DB forever.
  const articleThreshold = new Date(now);
  articleThreshold.setDate(articleThreshold.getDate() - 3);

  const articleResult = await db
    .delete(articles)
    .where(
      and(
        eq(articles.isFavorite, false),
        sql`NOT EXISTS (
          SELECT 1 FROM ${favoriteArticles}
          WHERE ${favoriteArticles.articleId} = ${articles.id}
        )`,
        sql`COALESCE(${articles.publishedAt}, ${articles.createdAt}) < ${articleThreshold}`
      )
    )
    .returning({ id: articles.id });

  const deletedArticles = articleResult.length;

  // 2. Delete generated posts older than 30 days
  const postThreshold = new Date(now);
  postThreshold.setDate(postThreshold.getDate() - 30);

  const postResult = await db
    .delete(generatedPosts)
    .where(lt(generatedPosts.createdAt, postThreshold))
    .returning({ id: generatedPosts.id });

  const deletedPosts = postResult.length;

  // 3. Delete operation logs older than 7 days
  const logThreshold = new Date(now);
  logThreshold.setDate(logThreshold.getDate() - 7);

  const logResult = await db
    .delete(operationLogs)
    .where(lt(operationLogs.createdAt, logThreshold))
    .returning({ id: operationLogs.id });

  const deletedLogs = logResult.length;

  logger.info(
    { deletedArticles, deletedPosts, deletedLogs },
    "Cleanup complete"
  );

  return { deletedArticles, deletedPosts, deletedLogs };
}
