import { z } from "zod";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DOMAIN: z.string().default("localhost"),
  PORT: z.string().default("3001"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, "ENCRYPTION_KEY must be 64 hex characters (32 bytes)"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  YANDEX_CLIENT_ID: z.string().optional(),
  YANDEX_CLIENT_SECRET: z.string().optional(),

  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  YOOKASSA_RETURN_URL: z.string().default("http://localhost:3000/payment/success"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
  // eslint-disable-next-line no-console
  console.error("Environment validation failed:\n", errors);
  console.error("\n[env] Debug — present env vars:", Object.keys(process.env).filter(k =>
    k.includes("DATABASE") || k.includes("REDIS") || k.includes("JWT") || k.includes("ENCRYPTION") || k.includes("NODE_ENV")
  ).join(", "));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
