import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
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
