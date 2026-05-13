import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/api/src/db/schema.ts",
  out: "./packages/api/src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    connectionString: "postgresql://newsradar:nr_str0ng_p4ss_2026!@tigernews-db:5432/newsradar",
  },
} satisfies Config;