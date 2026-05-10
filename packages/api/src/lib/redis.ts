import Redis from "ioredis";
import { env } from "../config/env.js";

let _connection: Redis | null = null;

/**
 * Get a shared Redis connection instance for BullMQ queues.
 * BullMQ requires a raw ioredis connection.
 */
export function getRedisConnection(): Redis {
  if (!_connection) {
    _connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    });
  }
  return _connection;
}

/**
 * Get a separate Redis connection for pub/sub (SSE, etc.).
 * Redis requires separate connections for subscribe and publish.
 */
export function getRedisSubscriber(): Redis {
  return new Redis(env.REDIS_URL);
}

export function getRedisPublisher(): Redis {
  return new Redis(env.REDIS_URL);
}
