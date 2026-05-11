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

/**
 * ------------------------------------------------------------------
 * Queue registry — single source of truth for all BullMQ queues.
 * ------------------------------------------------------------------
 *
 * Queue instances are imported from connection/redis.ts (single source).
 * Workers are created here and registered at startup.
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
 *  10. cleanup           — Periodic cleanup of old jobs / data
 *  11. favorites-cleanup — Remove stale favorites references
 *  12. posts-cleanup     — Remove old generated posts
 *
 * ------------------------------------------------------------------
 */

import { createWorker, attachWorkerLogging } from "./connection/bullmq.js";
import {
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
  allProducerQueues as allQueues,
} from "./connection/redis.js";
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
import type { Logger } from "pino";
import type { Worker } from "bullmq";

// Re-export all queues for external consumers
export {
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
  allQueues,
};

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
    async (job) => processFetchSource(job, logger),
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
      await semanticDedupQueue.add(`semantic-dedup-${articleId}`, { articleId }, { jobId: `semantic-dedup-${articleId}` });
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
