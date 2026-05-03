import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "../../api/src/db/schema.js";

/**
 * PostgreSQL connection pool shared across the worker process.
 * Uses the same DATABASE_URL as the API layer.
 *
 * Schema is imported from the API package to keep a single source of truth.
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

// Drizzle ORM instance with full schema for typed queries
export const db = drizzle(pool, { schema });

/**
 * Raw SQL executor for advanced queries (pg_trgm, etc.).
 */
export async function executeRaw<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/**
 * Gracefully close the PostgreSQL pool.
 */
export async function closeDb(): Promise<void> {
  await pool.end();
}
