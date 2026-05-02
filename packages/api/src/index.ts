import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "passport";
import { env } from "./config/env.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/request-log.js";
import { generalRateLimit } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";

import authRoutes from "./modules/auth/routes.js";
import workspaceRoutes from "./modules/workspaces/routes.js";
import healthRoutes from "./modules/health/routes.js";
import operationLogRoutes from "./modules/operation-logs/routes.js";
import eventRoutes from "./modules/events/routes.js";

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

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/operation-logs", operationLogRoutes);
app.use("/api/v1/events", eventRoutes);

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
