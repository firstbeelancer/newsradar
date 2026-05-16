/**
 * ------------------------------------------------------------------
 * Queue registry — single source of truth for all BullMQ queues.
 * ------------------------------------------------------------------
 *
 * Pipeline queues (data flow):
 *   1. fetch-source      — RSS / API fetching for each news source
 *   2. raw-dedup         — Deduplicate raw articles by URL hash
 *   3. translate         — Translate non-Russian content to Russian
 *   4. semantic-dedup    — Semantic deduplication via embeddings
 *   5. ingest-analysis   — Store article + run NLP analysis
 *   6. score-article     — AI scoring (relevance, quality, etc.)
 *   7. generate-post     — Create social-media post from article
 *   8. generate-digest   — Compile daily / weekly digest
 *
 * Utility queues:
 *   9. deepsearch        — Background deep research tasks
 *  10. cleanup          — Periodic cleanup of old jobs / data
 *  11. favorites-cleanup — Remove stale favorites references
 *  12. posts-cleanup    — Remove old generated posts
 *
 * ------------------------------------------------------------------
 */

import { createQueue, createWorker, attachWorkerLogging } from "./connection/bullmq.js";
import { processFetchSource, type FetchSourceJob } from "./workers/fetch-source.worker.js";
import { processRawDedup, type RawDedupJob } from "./workers/raw-dedup.worker.js";
import { processTranslate, type TranslateJob } from "./workers/translate.worker.js";
import { processSemanticDedup, type SemanticDedupJob } from "./workers/semantic-dedup.worker.js";
import { processScoreArticle, type ScoreArticleJob } from "./workers/score-article.worker.js";
import { processGeneratePost, type GeneratePostJob } from "./workers/generate-post.worker.js";
import { processGenerateDigest, type GenerateDigestJob } from "./workers/generate-digest.worker.js";
import { processCleanup, type CleanupJob } from "./workers/cleanup.worker.js";
import { processFavoritesCleanup, type FavoritesCleanupJob } from "./workers/favorites-cleanup.worker.js";
import { processPostsCleanup, type PostsCleanupJob } from "./workers/posts-cleanup.worker.js";
import { db } from "./db/index.js";
import { operationLogs } from "./db/schema.js";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import type { Worker, Job } from "bullmq";

/* ─── Queue declarations ─── */

/** 1. Fetch raw content from RSS feeds and external APIs. */
export const fetchSourceQueue = createQueue("fetch-source");

/** 2. Deduplicate articles by raw URL / content hash. */
export const rawDedupQueue = createQueue("raw-dedup");

/** 3. Translate article content to Russian when needed. */
export const translateQueue = createQueue("translate");

/** 4. Semantic deduplication using vector embeddings. */
export const semanticDedupQueue = createQueue("semantic-dedup");

/** 5. Persist article to DB and trigger NLP enrichment. */
export const ingestAnalysisQueue = createQueue("ingest-analysis");

/** 6. AI-powered scoring of article relevance & quality. */
export const scoreArticleQueue = createQueue("score-article");

/** 7. Generate social-media post from scored article. */
export const generatePostQueue = createQueue("generate-post");

/** 8. Compile daily / weekly digest of top articles. */
export const generateDigestQueue = createQueue("generate-digest");

/** 9. Deep research background jobs. */
export const deepsearchQueue = createQueue("deepsearch");

/** 10. General cleanup of expired jobs and temporary data. */
export const cleanupQueue = createQueue("cleanup");

/** 11. Cleanup of stale favorite references. */
export const favoritesCleanupQueue = createQueue("favorites-cleanup");

/** 12. Cleanup of old generated posts. */
export const postsCleanupQueue = createQueue("posts-cleanup");

/**
 * All queues as an array — useful for bulk operations (pause, resume, close).
 */
export const allQueues = [
  fetchSourceQueue,
  rawDedupQueue,
  translateQueue,
  semanticDedupQueue,
  ingestAnalysisQueue,
  scoreArticleQueue,
  generatePostQueue,
  generateDigestQueue,
  deepsearchQueue,
  cleanupQueue,
  favoritesCleanupQueue,
  postsCleanupQueue,
];

/* ─── Worker registry ─── */

let workers: Worker[] = [];

/**
 * Register all worker processors and start consuming jobs.
 *
 * @param logger — pino logger instance
 * @returns Array of running Worker instances
 */
export function registerWorkers(logger: Logger): Worker[] {
  // Prevent double registration
  if (workers.length > 0) {
    logger.warn("Workers already registered, skipping");
    return workers;
  }

  /* 1. fetch-source */
  const fetchSourceWorker = createWorker<FetchSourceJob>(
    "fetch-source",
    async (job) => {
      // Handle finalize-collection jobs
      if (job.name === "finalize-collection") {
        const { operationId, expectedCount } = job.data as unknown as { operationId: string; expectedCount: number };
        logger.info({ operationId, expectedCount }, "Finalizing collection operation");
        try {
          const existingLog = await db
            .select({ metadata: operationLogs.metadata, status: operationLogs.status })
            .from(operationLogs)
            .where(eq(operationLogs.id, operationId))
            .limit(1);
          if (existingLog[0]) {
            const meta = (existingLog[0].metadata as Record<string, unknown>) ?? {};
            const results = (meta.results as Array<Record<string, unknown>>) ?? [];
            const successCount = results.filter(r => r.status === "success").length;
            const errorCount = results.filter(r => r.status === "error").length;
            const newStatus = errorCount > 0 && successCount > 0 ? "partial" : errorCount > 0 ? "failed" : "success";
            const totalNew = results.reduce((sum, r) => sum + ((r.new as number) ?? 0), 0);
            await db
              .update(operationLogs)
              .set({
                status: newStatus,
                message: `Сбор завершён: ${successCount} источников обработано, ${errorCount} ошибок, ${totalNew} новых статей`,
                finishedAt: new Date(),
              })
              .where(eq(operationLogs.id, operationId));
            logger.info({ operationId, newStatus, successCount, errorCount, totalNew }, "Collection operation finalized");
          }
        } catch (err) {
          logger.error({ err: String(err), operationId }, "Failed to finalize collection");
        }
        return { finalized: true };
      }
      return processFetchSource(job as Job<FetchSourceJob>, logger);
    },
    { concurrency: 3 }
  );
  attachWorkerLogging(fetchSourceWorker, logger);

  /* 2. raw-dedup */
  const rawDedupWorker = createWorker<RawDedupJob>(
    "raw-dedup",
    async (job) => processRawDedup(job, logger),
    { concurrency: 5 }
  );
  attachWorkerLogging(rawDedupWorker, logger);

  /* 3. translate */
  const translateWorker = createWorker<TranslateJob>(
    "translate",
    async (job) => processTranslate(job, logger),
    { concurrency: 3 }
  );
  attachWorkerLogging(translateWorker, logger);

  /* 4. semantic-dedup */
  const semanticDedupWorker = createWorker<SemanticDedupJob>(
    "semantic-dedup",
    async (job) => processSemanticDedup(job, logger),
    { concurrency: 3 }
  );
  attachWorkerLogging(semanticDedupWorker, logger);

  /* 5. ingest-analysis — passthrough to semantic-dedup for now */
  const ingestAnalysisWorker = createWorker(
    "ingest-analysis",
    async (job) => {
      const { articleId } = job.data as { articleId: string };
      logger.debug({ articleId, jobId: job.id }, "Ingest analysis → semantic dedup");

      // Forward to semantic dedup queue
      const { semanticDedupQueue: sdq } = await import("./connection/redis.js");
      await sdq.add(`semantic-dedup-${articleId}`, { articleId }, { jobId: `semantic-dedup-${articleId}` });
      return { forwarded: true, articleId };
    },
    { concurrency: 5 }
  );
  attachWorkerLogging(ingestAnalysisWorker, logger);

  /* 6. score-article */
  const scoreArticleWorker = createWorker<ScoreArticleJob>(
    "score-article",
    async (job) => processScoreArticle(job, logger),
    { concurrency: 3 }
  );
  attachWorkerLogging(scoreArticleWorker, logger);

  /* 7. generate-post */
  const generatePostWorker = createWorker<GeneratePostJob>(
    "generate-post",
    async (job) => processGeneratePost(job, logger),
    { concurrency: 2 }
  );
  attachWorkerLogging(generatePostWorker, logger);

  /* 8. generate-digest */
  const generateDigestWorker = createWorker<GenerateDigestJob>(
    "generate-digest",
    async (job) => processGenerateDigest(job, logger),
    { concurrency: 2 }
  );
  attachWorkerLogging(generateDigestWorker, logger);

  /* 9. deepsearch — stub (not in Layer 2-4 scope) */
  const deepsearchWorker = createWorker(
    "deepsearch",
    async (job) => {
      logger.debug({ jobId: job.id }, "Deepsearch job received (stub)");
      return { status: "skipped" };
    },
    { concurrency: 1 }
  );
  attachWorkerLogging(deepsearchWorker, logger);

  /* 10. cleanup */
  const cleanupWorker = createWorker<CleanupJob>(
    "cleanup",
    async (job) => processCleanup(job, logger),
    { concurrency: 1 }
  );
  attachWorkerLogging(cleanupWorker, logger);

  /* 11. favorites-cleanup */
  const favoritesCleanupWorker = createWorker<FavoritesCleanupJob>(
    "favorites-cleanup",
    async (job) => processFavoritesCleanup(job, logger),
    { concurrency: 2 }
  );
  attachWorkerLogging(favoritesCleanupWorker, logger);

  /* 12. posts-cleanup */
  const postsCleanupWorker = createWorker<PostsCleanupJob>(
    "posts-cleanup",
    async (job) => processPostsCleanup(job, logger),
    { concurrency: 1 }
  );
  attachWorkerLogging(postsCleanupWorker, logger);

  workers = [
    fetchSourceWorker,
    rawDedupWorker,
    translateWorker,
    semanticDedupWorker,
    ingestAnalysisWorker,
    scoreArticleWorker,
    generatePostWorker,
    generateDigestWorker,
    deepsearchWorker,
    cleanupWorker,
    favoritesCleanupWorker,
    postsCleanupWorker,
  ];

  logger.info({ count: workers.length }, "All workers registered and started");

  return workers;
}

/**
 * Get the list of currently registered workers.
 */
export function getWorkers(): Worker[] {
  return workers;
}

/**
 * Gracefully close all workers.
 */
export async function closeWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
}
