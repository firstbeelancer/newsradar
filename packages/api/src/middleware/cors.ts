import cors from "cors";
import { env } from "../config/env.js";

export const corsMiddleware = cors({
  origin: env.NODE_ENV === "production" ? [`https://${env.DOMAIN}`] : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Request-Id"],
});
