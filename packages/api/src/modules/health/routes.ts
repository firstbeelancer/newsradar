import { Router } from "express";
import { pool } from "../../db/index.js";
import { env } from "../../config/env.js";
import { getRedisConnection } from "../../lib/redis.js";
import { getAllQueues } from "../../lib/queues.js";

const router = Router();

// Simple health check
router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "3.2.0",
      environment: env.NODE_ENV,
    },
  });
});

// Deep health check with DB + Redis + Worker
router.get("/deep", async (_req, res) => {
  const checks: Record<string, "ok" | "error"> = {
    api: "ok",
    database: "error",
    redis: "error",
    worker: "error",
  };
  let workerMeta: { build?: string; timestamp?: number; pid?: number } | null = null;
  let queueStats: Record<string, Record<string, number>> = {};
  let queueFailures: Record<string, Array<{ id: string; name: string; failedReason: string }>> = {};

  try {
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    const redis = getRedisConnection();
    await redis.ping();
    checks.redis = "ok";

    // Check worker heartbeat
    const heartbeat = await redis.get("newsradar:worker:heartbeat");
    const rawMeta = await redis.get("newsradar:worker:meta");
    if (rawMeta) {
      try {
        workerMeta = JSON.parse(rawMeta) as { build?: string; timestamp?: number; pid?: number };
      } catch {
        workerMeta = { build: "unparseable-meta" };
      }
    }
    if (heartbeat) {
      const age = Date.now() - parseInt(heartbeat, 10);
      checks.worker = age < 120_000 ? "ok" : "error"; // 2 min threshold
    }

    const queues = getAllQueues();
    const stats = await Promise.all(
      queues.map(async (queue) => {
        const counts = await queue.getJobCounts(
          "active",
          "waiting",
          "delayed",
          "completed",
          "failed",
          "paused"
        );
        return [queue.name, counts] as const;
      })
    );
    queueStats = Object.fromEntries(stats);

    const failures = await Promise.all(
      queues.map(async (queue) => {
        const failedJobs = await queue.getJobs(["failed"], 0, 2, true);
        const summary = failedJobs.map((job) => ({
          id: String(job.id ?? ""),
          name: job.name,
          failedReason: job.failedReason ?? "unknown",
        }));
        return [queue.name, summary] as const;
      })
    );
    queueFailures = Object.fromEntries(
      failures.filter(([, failedJobs]) => failedJobs.length > 0)
    );
  } catch {
    checks.redis = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  res.status(allOk ? 200 : 503).json({
    success: allOk,
    data: {
      status: allOk ? "healthy" : "unhealthy",
      checks,
      workerMeta,
      queueStats,
      queueFailures,
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
