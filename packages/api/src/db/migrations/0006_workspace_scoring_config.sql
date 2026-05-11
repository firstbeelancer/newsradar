-- ─────────────────────────────────────────────────────────────
-- Delta migration: add workspace_scoring_config table
-- Target DB: newsradar (production)
-- Date: 2026-05-12
-- ─────────────────────────────────────────────────────────────

-- 1. workspace_scoring_config — persistent scoring weights per workspace
CREATE TABLE IF NOT EXISTS "workspace_scoring_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "ai_relevance" decimal(5,4) DEFAULT '0.3500' NOT NULL,
  "keyword_match" decimal(5,4) DEFAULT '0.2500' NOT NULL,
  "freshness" decimal(5,4) DEFAULT '0.2000' NOT NULL,
  "source_trust" decimal(5,4) DEFAULT '0.2000' NOT NULL,
  "chip_filters" jsonb DEFAULT '{}' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_scoring_config_workspace_id_idx"
  ON "workspace_scoring_config"("workspace_id");

-- 2. Add subject_area column to agents if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'subject_area'
  ) THEN
    ALTER TABLE "agents" ADD COLUMN "subject_area" varchar(50);
    CREATE INDEX IF NOT EXISTS "agents_subject_area_idx" ON "agents"("subject_area");
  END IF;
END $$;

-- 3. Add GIN index on article_scores.chips for faster JSONB containment queries
CREATE INDEX IF NOT EXISTS "article_scores_chips_gin_idx"
  ON "article_scores" USING gin ("chips");
