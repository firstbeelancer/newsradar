import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "passport";
import { env } from "./config/env.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/request-log.js";
import { generalRateLimit } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
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
// Layer 2.5 — Subject Areas (global catalog)
import subjectAreaRoutes from "./modules/subject-areas/routes.js";
// Layer 3 — AI + Scoring
import scoringRoutes from "./modules/scoring/routes.js";
import aiProviderRoutes from "./modules/ai-providers/routes.js";
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
// Layer 2.5
app.use("/api/v1/subject-areas", subjectAreaRoutes);
// Layer 3
app.use("/api/v1/scoring", scoringRoutes);
app.use("/api/v1/ai-providers", aiProviderRoutes);
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
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] Server running on port ${PORT} (${env.NODE_ENV})`);
});
export default app;
//# sourceMappingURL=index.js.map