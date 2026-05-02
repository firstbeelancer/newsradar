import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";

/**
 * PostgreSQL connection pool shared across the worker process.
 * Uses the same DATABASE_URL as the API layer.
 *
 * Schema is imported from the API package to keep a single source of truth.
 * When the API schema is available, import it here:
 *   import * as schema from "../../api/src/db/schema";
 *   export const db = drizzle(pool, { schema });
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

// Drizzle ORM instance — schema will be wired once API package defines it
export const db = drizzle(pool);

/**
 * Gracefully close the PostgreSQL pool.
 */
export async function closeDb(): Promise<void> {
  await pool.end();
}
