-- On-demand full article translations for History → Переводы
CREATE TABLE IF NOT EXISTS "article_full_translations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "source_lang" varchar(10),
  "title" text,
  "content" text,
  "original_title" text,
  "original_url" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "article_full_translations_workspace_id_idx"
  ON "article_full_translations" ("workspace_id");
CREATE INDEX IF NOT EXISTS "article_full_translations_article_id_idx"
  ON "article_full_translations" ("article_id");
CREATE INDEX IF NOT EXISTS "article_full_translations_status_idx"
  ON "article_full_translations" ("status");
CREATE INDEX IF NOT EXISTS "article_full_translations_created_at_idx"
  ON "article_full_translations" ("created_at");
