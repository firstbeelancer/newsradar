import { Redis } from "ioredis";
import { Queue } from "bullmq";
import { env } from "../config/env.js";

/**
 * Redis connection singleton reused across all BullMQ queues and workers.
 *
 * BullMQ requires a Redis instance with support for:
 *   - Lua scripts (EVAL)
 *   - Streams (XADD / XREADGROUP)
 *   - RedisJSON (for job data)
 *
 * This connection is shared to avoid resource exhaustion.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("connect", () => {
  // Handled at startup in index.ts
});

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err.message);
});

/**
 * BullMQ Queue instances for adding jobs from anywhere in the worker.
 * These are separate from the queue declarations in queues.ts to avoid
 * circular dependencies — queues.ts exports the names/registry,
 * this file exports the actual Queue objects for job production.
 */

/** 1. Fetch raw content from RSS feeds and external APIs. */
export const fetchSourceQueue = new Queue("fetch-source", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 2. Deduplicate articles by raw URL / content hash. */
export const rawDedupQueue = new Queue("raw-dedup", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 3. Translate article content to Russian when needed. */
export const translateQueue = new Queue("translate", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 4. Semantic deduplication using vector embeddings. */
export const semanticDedupQueue = new Queue("semantic-dedup", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 5. Persist article to DB and trigger NLP enrichment. */
export const ingestAnalysisQueue = new Queue("ingest-analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 6. AI-powered scoring of article relevance & quality. */
export const scoreArticleQueue = new Queue("score-article", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 7. Generate social-media post from scored article. */
export const generatePostQueue = new Queue("generate-post", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 8. Compile daily / weekly digest of top articles. */
export const generateDigestQueue = new Queue("generate-digest", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 9. Deep research background jobs. */
export const deepsearchQueue = new Queue("deepsearch", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 10. General cleanup of expired jobs and temporary data. */
export const cleanupQueue = new Queue("cleanup", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 11. Cleanup of stale favorite references. */
export const favoritesCleanupQueue = new Queue("favorites-cleanup", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/** 12. Cleanup of old generated posts. */
export const postsCleanupQueue = new Queue("posts-cleanup", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * All producer queues as an array — useful for bulk operations (pause, resume, close).
 */
export const allProducerQueues = [
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

/**
 * Disconnect from Redis. Called during graceful shutdown.
 * Closes all producer queues before disconnecting.
 */
export async function closeRedis(): Promise<void> {
  // Close all producer queues first
  await Promise.all(allProducerQueues.map((q) => q.close()));

  if (redis.status !== "end") {
    await redis.quit();
  }
}
