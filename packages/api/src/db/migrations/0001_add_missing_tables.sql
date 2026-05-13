-- ─────────────────────────────────────────────────────────────
-- Delta migration: add 11 missing tables for newsradar MVP
-- Applied to: newsradar DB (container db-ujrgju3bsyi1zvba5afa5gql-142412449171)
-- Date: 2026-05-09
-- ─────────────────────────────────────────────────────────────

-- Layer 3 — AI Providers
CREATE TABLE IF NOT EXISTS "ai_providers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "type" varchar(16) NOT NULL,
        "provider" varchar(20) NOT NULL,
        "base_url" text,
        "api_key_encrypted" text,
        "model" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "workspace_id" uuid NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ai_providers_workspace_id_idx" ON "ai_providers" ("workspace_id");
CREATE INDEX IF NOT EXISTS "ai_providers_is_active_idx" ON "ai_providers" ("is_active");
ALTER TABLE "ai_providers" DROP CONSTRAINT IF EXISTS "ai_providers_workspace_id_workspaces_id_fk";
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_workspace_id_workspaces_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
ALTER TABLE "ai_providers" DROP CONSTRAINT IF EXISTS "ai_providers_type_check";
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_type_check"
        CHECK ("type" IN ('platform', 'byok'));
ALTER TABLE "ai_providers" DROP CONSTRAINT IF EXISTS "ai_providers_provider_check";
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_provider_check"
        CHECK ("provider" IN ('openai', 'anthropic', 'openrouter', 'google'));

-- Layer 0 — Subject Areas
CREATE TABLE IF NOT EXISTS "subject_areas" (
        "id" varchar(50) PRIMARY KEY,
        "label" varchar(100) NOT NULL,
        "icon" varchar(50) DEFAULT 'circle' NOT NULL,
        "color" varchar(7) DEFAULT '#3b82f6' NOT NULL,
        "default_topic" text NOT NULL,
        "default_audience" text NOT NULL,
        "defaults_json" jsonb DEFAULT '{}' NOT NULL,
        "position" integer DEFAULT 0 NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "subject_areas_position_idx" ON "subject_areas" ("position");

-- Layer 2 — Article Scores
CREATE TABLE IF NOT EXISTS "article_scores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "article_id" uuid NOT NULL,
        "ai_relevance" decimal(3,2),
        "keyword_match" decimal(3,2),
        "freshness" decimal(3,2),
        "source_trust" decimal(3,2),
        "overall_score" decimal(5,3) DEFAULT '0.000' NOT NULL,
        "weighted_score" decimal(5,3) DEFAULT '0.000' NOT NULL,
        "weights_snapshot" jsonb,
        "chips" jsonb DEFAULT '[]' NOT NULL,
        "score_detail" jsonb DEFAULT '{}' NOT NULL,
        "scored_at" timestamptz,
        "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "article_scores_article_id_idx" ON "article_scores" ("article_id");
CREATE INDEX "article_scores_overall_idx" ON "article_scores" ("overall_score");
CREATE INDEX "article_scores_weighted_idx" ON "article_scores" ("weighted_score");
ALTER TABLE "article_scores" ADD CONSTRAINT "article_scores_article_id_fk"
        FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade;

-- Layer 2 — Scoring Criteria
CREATE TABLE IF NOT EXISTS "scoring_criteria" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" uuid NOT NULL,
        "criterion_type" varchar(50) NOT NULL,
        "label" varchar(100) NOT NULL,
        "weight" decimal(5,4) DEFAULT '0.0000' NOT NULL,
        "threshold" decimal(5,4),
        "config" jsonb DEFAULT '{}' NOT NULL,
        "position" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "scoring_criteria_agent_id_idx" ON "scoring_criteria" ("agent_id");
CREATE INDEX "scoring_criteria_type_idx" ON "scoring_criteria" ("criterion_type");
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_agent_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade;
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_type_check"
        CHECK ("criterion_type" IN ('ai_relevance', 'keyword_match', 'freshness', 'source_trust', 'custom'));
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_weight_check"
        CHECK ("weight" >= 0 AND "weight" <= 1);

-- Layer 2 — Chip Filters
CREATE TABLE IF NOT EXISTS "chip_filters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" uuid NOT NULL,
        "key" varchar(50) NOT NULL,
        "label" varchar(100) NOT NULL,
        "description" text,
        "pattern" text,
        "operator" varchar(20) DEFAULT 'contains' NOT NULL,
        "score_modifier" decimal(5,4) DEFAULT '0.0000' NOT NULL,
        "color" varchar(20) DEFAULT 'default' NOT NULL,
        "icon" varchar(50),
        "threshold" decimal(5,4),
        "is_active" boolean DEFAULT true NOT NULL,
        "position" integer DEFAULT 0 NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "chip_filters_agent_id_idx" ON "chip_filters" ("agent_id");
CREATE INDEX "chip_filters_key_idx" ON "chip_filters" ("key");
CREATE UNIQUE INDEX "chip_filters_agent_key_unique_idx" ON "chip_filters" ("agent_id", "key");
ALTER TABLE "chip_filters" ADD CONSTRAINT "chip_filters_agent_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade;
ALTER TABLE "chip_filters" ADD CONSTRAINT "chip_filters_operator_check"
        CHECK ("operator" IN ('contains', 'not_contains', 'equals', 'starts_with', 'regex', 'in', 'gt', 'lt', 'gte', 'lte'));

-- Layer 2 — Article Fingerprints
CREATE TABLE IF NOT EXISTS "article_fingerprints" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "article_id" uuid NOT NULL,
        "fingerprint_hash" varchar(255) NOT NULL,
        "fingerprint_type" varchar(20) NOT NULL,
        "source_guid" varchar(500),
        "canonical_url" text,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "article_fingerprints_hash_type_unique" ON "article_fingerprints" ("fingerprint_hash", "fingerprint_type");
CREATE INDEX "article_fingerprints_article_id_idx" ON "article_fingerprints" ("article_id");
CREATE INDEX "article_fingerprints_expires_idx" ON "article_fingerprints" ("expires_at");
ALTER TABLE "article_fingerprints" ADD CONSTRAINT "article_fingerprints_article_id_fk"
        FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade;
ALTER TABLE "article_fingerprints" ADD CONSTRAINT "article_fingerprints_type_check"
        CHECK ("fingerprint_type" IN ('url_hash', 'guid', 'title_hash', 'semantic'));

-- Layer 3 — Favorite Articles
CREATE TABLE IF NOT EXISTS "favorite_articles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspace_id" uuid NOT NULL,
        "article_id" uuid NOT NULL,
        "agent_id" uuid,
        "source_id" uuid,
        "ttl_mode" varchar(10) DEFAULT '30d' NOT NULL,
        "expires_at" timestamptz,
        "note" text,
        "score_at_favorite" decimal(5,3),
        "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "favorite_articles_workspace_article_unique" ON "favorite_articles" ("workspace_id", "article_id");
CREATE INDEX "favorite_articles_workspace_id_idx" ON "favorite_articles" ("workspace_id");
CREATE INDEX "favorite_articles_article_id_idx" ON "favorite_articles" ("article_id");
CREATE INDEX "favorite_articles_expires_at_idx" ON "favorite_articles" ("expires_at");
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_workspace_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_article_id_fk"
        FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade;
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_agent_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null;
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_source_id_fk"
        FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null;
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_ttl_mode_check"
        CHECK ("ttl_mode" IN ('30d', 'forever'));

-- Layer 3 — Asset Packs
CREATE TABLE IF NOT EXISTS "asset_packs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspace_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "s3_prefix" varchar(255),
        "item_count" integer DEFAULT 0 NOT NULL,
        "max_items" integer DEFAULT 100 NOT NULL,
        "is_default" boolean DEFAULT false NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "asset_packs_workspace_id_idx" ON "asset_packs" ("workspace_id");
ALTER TABLE "asset_packs" ADD CONSTRAINT "asset_packs_workspace_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;

-- Layer 3 — Asset Items
CREATE TABLE IF NOT EXISTS "asset_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "pack_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "name" varchar(100) NOT NULL,
        "value" text NOT NULL,
        "label" varchar(200),
        "metadata" jsonb DEFAULT '{}' NOT NULL,
        "position" integer DEFAULT 0 NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "asset_items_pack_id_idx" ON "asset_items" ("pack_id");
CREATE UNIQUE INDEX "asset_items_pack_name_unique" ON "asset_items" ("pack_id", "name");
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_pack_id_fk"
        FOREIGN KEY ("pack_id") REFERENCES "public"."asset_packs"("id") ON DELETE cascade;
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_type_check"
        CHECK ("type" IN ('emoji', 'icon', 'color', 'font_size', 'layout'));

-- Layer 4 — Content Templates (уже есть в старой миграции — проверяем)
-- Layer 4 — Generated Posts (уже есть в старой миграции — проверяем)

-- Layer 5 — Notification Rules
CREATE TABLE IF NOT EXISTS "notification_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspace_id" uuid NOT NULL,
        "agent_id" uuid,
        "event_type" varchar(50) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "threshold" decimal(5,3),
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "notification_rules_workspace_id_idx" ON "notification_rules" ("workspace_id");
CREATE INDEX "notification_rules_agent_id_idx" ON "notification_rules" ("agent_id");
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_workspace_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_agent_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade;
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_channel_check"
        CHECK ("channel" IN ('telegram', 'email', 'web'));

-- Layer 7 — Fetch Schedules
CREATE TABLE IF NOT EXISTS "fetch_schedules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspace_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "cron_expression" varchar(100) NOT NULL,
        "preset" varchar(20),
        "is_active" boolean DEFAULT true NOT NULL,
        "description" text,
        "next_run_at" timestamptz,
        "last_run_at" timestamptz,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "fetch_schedules_workspace_id_idx" ON "fetch_schedules" ("workspace_id");
CREATE INDEX "fetch_schedules_next_run_idx" ON "fetch_schedules" ("next_run_at");
ALTER TABLE "fetch_schedules" ADD CONSTRAINT "fetch_schedules_workspace_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
ALTER TABLE "fetch_schedules" ADD CONSTRAINT "fetch_schedules_preset_check"
        CHECK ("preset" IN ('every_hour', 'every_6h', 'every_day', 'custom'));

-- Layer 8 — DeepSearch Results
CREATE TABLE IF NOT EXISTS "deepsearch_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspace_id" uuid NOT NULL,
        "agent_id" uuid NOT NULL,
        "query" text NOT NULL,
        "status" varchar(20) DEFAULT 'pending' NOT NULL,
        "findings" jsonb DEFAULT '{}' NOT NULL,
        "report_text" text,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "error" text,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "deepsearch_results_workspace_id_idx" ON "deepsearch_results" ("workspace_id");
CREATE INDEX "deepsearch_results_agent_id_idx" ON "deepsearch_results" ("agent_id");
CREATE INDEX "deepsearch_results_status_idx" ON "deepsearch_results" ("status");
CREATE INDEX "deepsearch_results_created_at_idx" ON "deepsearch_results" ("created_at");
ALTER TABLE "deepsearch_results" ADD CONSTRAINT "deepsearch_results_workspace_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
ALTER TABLE "deepsearch_results" ADD CONSTRAINT "deepsearch_results_agent_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade;
ALTER TABLE "deepsearch_results" ADD CONSTRAINT "deepsearch_results_status_check"
        CHECK ("status" IN ('pending', 'running', 'completed', 'failed'));