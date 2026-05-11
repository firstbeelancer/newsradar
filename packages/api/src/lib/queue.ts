import { Redis } from "ioredis";
import { Queue } from "bullmq";
import { env } from "../config/env.js";

/**
 * Redis connection singleton for BullMQ queues in the API package.
 * Shares the same Redis instance as the Worker package.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", (err: Error) => {
  console.error("[queue] Redis connection error:", err.message);
});

/**
 * Fetch-source queue — mirrors the worker's fetchSourceQueue.
 * The API enqueues jobs here; the Worker picks them up and processes them.
 *
 * Queue name MUST match the worker's queue name exactly: "fetch-source"
 */
export const fetchSourceQueue = new Queue("fetch-source", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Score-article queue — used to enqueue scoring jobs from the API.
 * The Worker picks them up and processes them through the real scorer.
 */
export const scoreArticleQueue = new Queue("score-article", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Generate-post queue — used to enqueue post generation jobs from the API.
 * The Worker processes them with real AI streaming.
 */
export const generatePostQueue = new Queue("generate-post", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Generate-digest queue — used to enqueue digest generation jobs from the API.
 */
export const generateDigestQueue = new Queue("generate-digest", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Deepsearch queue — mirrors the worker's deepsearchQueue.
 * Used to enqueue deep research background jobs from the API.
 */
export const deepsearchQueue = new Queue("deepsearch", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Gracefully close all queue connections.
 */
export async function closeQueues(): Promise<void> {
  await fetchSourceQueue.close();
  await scoreArticleQueue.close();
  await generatePostQueue.close();
  await generateDigestQueue.close();
  await deepsearchQueue.close();
  if (redis.status !== "end") {
    await redis.quit();
  }
}
