import { config } from "dotenv";
import { z } from "zod";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // AI Platform Provider (shared across all workspaces)
  PLATFORM_AI_PROVIDER: z
    .enum(["openai", "anthropic", "openrouter", "google"])
    .default("openrouter"),
  PLATFORM_AI_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  PLATFORM_AI_MODEL: z.string().default("tencent/hy3-preview:free"),
  PLATFORM_AI_API_KEY: z.string().optional(),

  // S3-compatible storage
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  S3_PUBLIC_BASE_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.errors
    .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
    .join("\n");
  console.error(`Invalid environment variables:\n${errors}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
