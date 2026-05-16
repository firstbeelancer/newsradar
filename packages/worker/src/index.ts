import { sql } from "drizzle-orm";
import pino from "pino";
import { env } from "./config/env.js";
import { redis } from "./connection/redis.js";
import { db, closeDb } from "./db/index.js";
import { allQueues, registerWorkers, closeWorkers } from "./queues.js";
import { startHeartbeat, stopHeartbeat } from "./workers/heartbeat.worker.js";

/* ------------------------------------------------------------------ */
/* Logger                                                              */
/* ------------------------------------------------------------------ */
const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  name: "newsradar-worker",
});

/* ------------------------------------------------------------------ */
/* Shutdown flag                                                       */
/* ------------------------------------------------------------------ */
let isShuttingDown = false;

/**
 * Graceful shutdown handler.
 *
 * Sequence:
 *   1. Stop heartbeat
 *   2. Close all workers (drain active jobs)
 *   3. Close BullMQ queues
 *   4. Close Redis connection
 *   5. Close PostgreSQL pool
 *   6. Exit process
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, forcing exit");
    process.exit(1);
  }
  isShuttingDown = true;

  logger.info({ signal }, "Graceful shutdown initiated");

  try {
    logger.info("Stopping heartbeat...");
    stopHeartbeat(logger);

    // queue.pause() persists in Redis and can leave ingestion globally paused
    // after deploys, so shutdown should rely on worker.close() instead.
    logger.info("Closing workers...");
    await closeWorkers();

    logger.info("Closing queues...");
    await Promise.all(allQueues.map((q) => q.close()));

    logger.info("Closing Redis connection...");
    const { closeRedis } = await import("./connection/redis.js");
    await closeRedis();

    logger.info("Closing database pool...");
    await closeDb();

    logger.info("Shutdown complete, exiting");
    process.exit(0);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Error during shutdown"
    );
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Signal handlers                                                     */
/* ------------------------------------------------------------------ */
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

/* Handle uncaught errors */
process.on("uncaughtException", (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, "Uncaught exception");
  void gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason: String(reason) }, "Unhandled rejection");
  void gracefulShutdown("unhandledRejection");
});

/* ------------------------------------------------------------------ */
/* Startup                                                             */
/* ------------------------------------------------------------------ */
async function main(): Promise<void> {
  logger.info(
    { nodeEnv: env.NODE_ENV, redisUrl: env.REDIS_URL.replace(/:\/\/.*@/, "://***@") },
    "Starting Newsradar worker"
  );

  // 1. Touch Redis. BullMQ queues may already have started the shared connection.
  logger.info({ status: redis.status }, "Checking Redis connection...");
  await redis.ping();
  logger.info("Redis connected");

  // 2. Verify PostgreSQL connection
  logger.info("Verifying database connection...");
  try {
    const result = await db.execute(sql`SELECT 1`);
    logger.info({ rows: result.rows.length }, "Database connected");
  } catch (err) {
    logger.fatal(
      { err: err instanceof Error ? err.message : String(err) },
      "Database connection failed"
    );
    process.exit(1);
  }

  // 3. Start heartbeat
  startHeartbeat(redis, logger);

  // 4. Recover from any persisted BullMQ pause left by previous deploys/restarts.
  logger.info("Resuming queues...");
  await Promise.all(allQueues.map((q) => q.resume()));

  // 5. Register all worker processors
  logger.info("Registering workers...");
  registerWorkers(logger);

  logger.info(
    { queues: allQueues.map((q) => q.name) },
    "Newsradar worker ready, %d queues registered",
    allQueues.length
  );
}

// Run
void main();
