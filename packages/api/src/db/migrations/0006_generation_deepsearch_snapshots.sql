-- Migration 0006: TZ-aligned generated post snapshots, DeepSearch article links, and FTS.
-- Backward-compatible with existing rows and safe to re-run.

ALTER TABLE "generated_posts" ADD COLUMN IF NOT EXISTS "generated_text" text;
ALTER TABLE "generated_posts" ADD COLUMN IF NOT EXISTS "edited_text" text;
ALTER TABLE "generated_posts" ADD COLUMN IF NOT EXISTS "article_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;
ALTER TABLE "generated_posts" ADD COLUMN IF NOT EXISTS "article_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "generated_posts" ADD COLUMN IF NOT EXISTS "asset_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "generated_posts" ADD COLUMN IF NOT EXISTS "copied_at" timestamptz;
ALTER TABLE "generated_posts" ADD COLUMN IF NOT EXISTS "status" varchar(16) DEFAULT 'draft' NOT NULL;

UPDATE "generated_posts"
SET "generated_text" = COALESCE("generated_text", "content")
WHERE "generated_text" IS NULL;

UPDATE "generated_posts"
SET "edited_text" = COALESCE("edited_text", "content")
WHERE "is_edited" = true AND "edited_text" IS NULL;

UPDATE "generated_posts"
SET "copied_at" = COALESCE("copied_at", "updated_at")
WHERE "is_copied" = true AND "copied_at" IS NULL;

UPDATE "generated_posts"
SET "status" = CASE
  WHEN "is_copied" = true THEN 'copied'
  WHEN "is_edited" = true THEN 'edited'
  ELSE COALESCE("status", 'draft')
END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_posts'
      AND column_name = 'prompt_snapshot'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE "generated_posts"
      ALTER COLUMN "prompt_snapshot" DROP DEFAULT,
      ALTER COLUMN "prompt_snapshot" TYPE jsonb
      USING CASE
        WHEN "prompt_snapshot" IS NULL OR btrim("prompt_snapshot"::text) = '' THEN '{}'::jsonb
        ELSE "prompt_snapshot"::jsonb
      END,
      ALTER COLUMN "prompt_snapshot" SET DEFAULT '{}'::jsonb,
      ALTER COLUMN "prompt_snapshot" SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_posts'
      AND column_name = 'model_snapshot'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE "generated_posts"
      ALTER COLUMN "model_snapshot" DROP DEFAULT,
      ALTER COLUMN "model_snapshot" TYPE jsonb
      USING CASE
        WHEN "model_snapshot" IS NULL OR btrim("model_snapshot"::text) = '' THEN '{}'::jsonb
        ELSE jsonb_build_object('model', "model_snapshot"::text)
      END,
      ALTER COLUMN "model_snapshot" SET DEFAULT '{}'::jsonb,
      ALTER COLUMN "model_snapshot" SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "generated_posts_fts_idx"
ON "generated_posts"
USING gin (
  to_tsvector('russian', COALESCE("title", '') || ' ' || COALESCE("edited_text", "generated_text", "content", ''))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_posts_status_check'
  ) THEN
    ALTER TABLE "generated_posts"
      ADD CONSTRAINT "generated_posts_status_check"
      CHECK ("status" IN ('draft', 'edited', 'copied', 'archived'));
  END IF;
END $$;

ALTER TABLE "deepsearch_results" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE "deepsearch_results" ADD COLUMN IF NOT EXISTS "article_id" uuid;
ALTER TABLE "deepsearch_results" ADD COLUMN IF NOT EXISTS "ai_provider_id" uuid;
ALTER TABLE "deepsearch_results" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz;
ALTER TABLE "deepsearch_results" ADD COLUMN IF NOT EXISTS "failed_at" timestamptz;
ALTER TABLE "deepsearch_results" ADD COLUMN IF NOT EXISTS "error_message" text;

UPDATE "deepsearch_results"
SET "article_id" = NULLIF("findings"->>'articleId', '')::uuid
WHERE "article_id" IS NULL
  AND "findings" ? 'articleId'
  AND ("findings"->>'articleId') ~* '^[0-9a-f-]{36}$';

UPDATE "deepsearch_results"
SET "completed_at" = COALESCE("completed_at", "finished_at")
WHERE "status" = 'completed' AND "completed_at" IS NULL;

UPDATE "deepsearch_results"
SET "failed_at" = COALESCE("failed_at", "finished_at"),
    "error_message" = COALESCE("error_message", "error")
WHERE "status" = 'failed' AND ("failed_at" IS NULL OR "error_message" IS NULL);

CREATE INDEX IF NOT EXISTS "deepsearch_results_article_id_idx" ON "deepsearch_results" ("article_id");
CREATE INDEX IF NOT EXISTS "deepsearch_results_user_id_idx" ON "deepsearch_results" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deepsearch_results_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "deepsearch_results"
      ADD CONSTRAINT "deepsearch_results_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deepsearch_results_article_id_articles_id_fk'
  ) THEN
    ALTER TABLE "deepsearch_results"
      ADD CONSTRAINT "deepsearch_results_article_id_articles_id_fk"
      FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deepsearch_results_ai_provider_id_ai_providers_id_fk'
  ) THEN
    ALTER TABLE "deepsearch_results"
      ADD CONSTRAINT "deepsearch_results_ai_provider_id_ai_providers_id_fk"
      FOREIGN KEY ("ai_provider_id") REFERENCES "ai_providers"("id") ON DELETE set null;
  END IF;
END $$;
