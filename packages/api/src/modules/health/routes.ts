import { Router } from "express";
import { pool } from "../../db/index.js";
import { env } from "../../config/env.js";
import { getRedisConnection } from "../../lib/redis.js";

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
    if (heartbeat) {
      const age = Date.now() - parseInt(heartbeat, 10);
      checks.worker = age < 120_000 ? "ok" : "error"; // 2 min threshold
    }
  } catch {
    checks.redis = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  res.status(allOk ? 200 : 503).json({
    success: allOk,
    data: {
      status: allOk ? "healthy" : "unhealthy",
      checks,
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
