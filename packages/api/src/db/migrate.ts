import { Pool, type PoolClient } from "pg";
import { env } from "../config/env.js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

const MIGRATION_SENTINELS: Record<string, string[]> = {
  "0000_flashy_epoch.sql": [
    "agent_sources",
    "agents",
    "articles",
    "content_templates",
    "sources",
    "users",
    "workspaces",
  ],
  "0001_add_missing_tables.sql": [
    "ai_providers",
    "article_scores",
    "asset_items",
    "asset_packs",
    "chip_filters",
    "deepsearch_results",
    "favorite_articles",
    "fetch_schedules",
    "notification_rules",
    "scoring_criteria",
    "subject_areas",
  ],
};

async function migrationIsMaterialized(
  client: PoolClient,
  filename: string
): Promise<boolean> {
  const sentinelTables = MIGRATION_SENTINELS[filename];
  if (!sentinelTables) return false;

  const { rows } = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [sentinelTables]
  );

  return rows.length === sentinelTables.length;
}

/**
 * Runs all pending SQL migrations against the database.
 * Uses a simple tracking table `__migrations` to track which files have been applied.
 */
export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__migrations" (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    // Get list of already-applied migrations
    const { rows: applied } = await client.query(
      "SELECT filename FROM __migrations ORDER BY id"
    );
    const appliedSet = new Set(applied.map((r: { filename: string }) => r.filename));

    // Read migration files from disk
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[migrate] Already applied: ${file}`);
        continue;
      }

      if (await migrationIsMaterialized(client, file)) {
        await client.query("INSERT INTO __migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
        appliedSet.add(file);
        console.log(`[migrate] Baseline existing schema: ${file}`);
        continue;
      }

      console.log(`[migrate] Applying: ${file}`);
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO __migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] Applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate] FAILED: ${file}`, err);
        throw err;
      }
    }

    console.log("[migrate] All migrations applied");
  } finally {
    client.release();
    await pool.end();
  }
}
