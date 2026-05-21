import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "passport";
import { env } from "./config/env.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/request-log.js";
import { generalRateLimit } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { seedAdminUsers } from "./db/seed-admin.js";
import { runMigrations } from "./db/migrate.js";

// ─── Route modules ───

// Layer 1 — Auth & Workspace
import authRoutes from "./modules/auth/routes.js";
import workspaceRoutes from "./modules/workspaces/routes.js";
import healthRoutes from "./modules/health/routes.js";
import operationLogRoutes from "./modules/operation-logs/routes.js";
import eventRoutes from "./modules/events/routes.js";

// Layer 2 — Product Skeleton
import dashboardRoutes from "./modules/dashboard/routes.js";
import agentRoutes from "./modules/agents/routes.js";
import sourceRoutes from "./modules/sources/routes.js";
import articleRoutes from "./modules/articles/routes.js";
import searchRoutes from "./modules/search/routes.js";
import deepsearchRoutes from "./modules/deepsearch/routes.js";

// Layer 3 — AI + Scoring
import scoringRoutes from "./modules/scoring/routes.js";
import aiProviderRoutes from "./modules/ai-providers/routes.js";
import chipFilterRoutes from "./modules/chip-filters/routes.js";

// Layer 4 — Generation
import templateRoutes from "./modules/templates/routes.js";
import generationRoutes from "./modules/generation/routes.js";

// Layer 5 — Notifications
import notificationRoutes from "./modules/notifications/routes.js";

// Layer 6 — Subscriptions & Usage
import subscriptionRoutes from "./modules/subscriptions/routes.js";
import usageRoutes from "./modules/usage/routes.js";

// Layer 7 — iBoard (Pro dashboard)
import iboardRoutes from "./modules/iboard/routes.js";

const app = express();
const PORT = parseInt(env.PORT, 10);

// Security middleware
app.use(helmet());
app.use(corsMiddleware);
app.use(generalRateLimit);

// Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
app.use(requestLogger);

// Passport
app.use(passport.initialize());

// ─── Routes ───

// Layer 1
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/operation-logs", operationLogRoutes);
app.use("/api/v1/events", eventRoutes);

// Layer 2
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/agents", agentRoutes);
app.use("/api/v1/sources", sourceRoutes);
app.use("/api/v1/articles", articleRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/deepsearch", deepsearchRoutes);

// Layer 3
app.use("/api/v1/scoring", scoringRoutes);
app.use("/api/v1/ai-providers", aiProviderRoutes);
app.use("/api/v1/chip-filters", chipFilterRoutes);

// Layer 4
app.use("/api/v1/templates", templateRoutes);
app.use("/api/v1/generation", generationRoutes);

// Layer 5
app.use("/api/v1/notifications", notificationRoutes);

// Layer 6
app.use("/api/v1/subscription", subscriptionRoutes);
app.use("/api/v1/usage", usageRoutes);

// Layer 7
app.use("/api/v1/iboard", iboardRoutes);

// Global error handler
app.use(errorHandler);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Endpoint not found" },
  });
});

// ─── Bootstrap: migrations → seed → listen ───

async function bootstrap() {
  try {
    // 0. Diagnostic: print env check (without exposing secrets)
    console.log("[bootstrap] Node version:", process.version);
    console.log("[bootstrap] NODE_ENV:", env.NODE_ENV);
    console.log("[bootstrap] DATABASE_URL set:", !!env.DATABASE_URL);
    console.log("[bootstrap] REDIS_URL set:", !!env.REDIS_URL);
    console.log("[bootstrap] JWT_SECRET length:", env.JWT_SECRET?.length ?? 0);
    console.log("[bootstrap] ENCRYPTION_KEY length:", env.ENCRYPTION_KEY?.length ?? 0);

    // 1. Run database migrations
    console.log("[bootstrap] Running database migrations...");
    await runMigrations();
    console.log("[bootstrap] Migrations complete");

    // 2. Seed admin users
    console.log("[bootstrap] Seeding admin users...");
    await seedAdminUsers();
    console.log("[bootstrap] Admin user check complete");

    // 3. Start server
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`[api] Server running on port ${PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    console.error("[bootstrap] Fatal error during startup:", err);
    process.exit(1);
  }
}

bootstrap();

export default app;
