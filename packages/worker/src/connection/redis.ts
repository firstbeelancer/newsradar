import IORedis from "ioredis";
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
export const redis = new IORedis(env.REDIS_URL, {
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
 * Disconnect from Redis. Called during graceful shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (redis.status !== "end") {
    await redis.quit();
  }
}
