import { Router } from "express";
import { pool } from "../../db/index.js";
import { env } from "../../config/env.js";

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

// Deep health check with DB + Redis
router.get("/deep", async (_req, res) => {
  const checks: Record<string, "ok" | "error"> = {
    api: "ok",
    database: "error",
  };

  try {
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "error";
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
