CREATE TABLE "agent_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"source_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50) DEFAULT 'rss' NOT NULL,
	"color" varchar(7) DEFAULT '#3b82f6' NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subject_area" varchar(50),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_fingerprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"fingerprint_hash" varchar(255) NOT NULL,
	"fingerprint_type" varchar(20) NOT NULL,
	"source_guid" varchar(500),
	"canonical_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_fingerprints_type_check" CHECK ("article_fingerprints"."fingerprint_type" IN ('url_hash', 'guid', 'title_hash', 'semantic'))
);
--> statement-breakpoint
CREATE TABLE "article_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"ai_relevance" numeric(3, 2),
	"keyword_match" numeric(3, 2),
	"freshness" numeric(3, 2),
	"source_trust" numeric(3, 2),
	"overall_score" numeric(5, 3) DEFAULT '0.000' NOT NULL,
	"weighted_score" numeric(5, 3) DEFAULT '0.000' NOT NULL,
	"weights_snapshot" jsonb,
	"chips" jsonb DEFAULT '[]' NOT NULL,
	"score_detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text,
	"original_title" text,
	"original_description" text,
	"detected_lang" varchar(10),
	"needs_translation" boolean DEFAULT false NOT NULL,
	"link" text NOT NULL,
	"guid" text,
	"published_at" timestamp with time zone,
	"author" text,
	"source_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"ai_summary" text,
	"category" varchar(50),
	"language" varchar(10) DEFAULT 'ru' NOT NULL,
	"score" numeric(5, 3) DEFAULT '0.000' NOT NULL,
	"score_detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_relevant" boolean,
	"relevance_reason" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"raw_hash" text,
	"semantic_group_id" uuid,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ttl_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_status_check" CHECK ("articles"."status" IN ('new', 'fetched', 'translated', 'analyzed', 'scored', 'deduped', 'published', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "asset_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"label" varchar(200),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_items_type_check" CHECK ("asset_items"."type" IN ('emoji', 'icon', 'color', 'font_size', 'layout'))
);
--> statement-breakpoint
CREATE TABLE "asset_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"s3_prefix" varchar(255),
	"item_count" integer DEFAULT 0 NOT NULL,
	"max_items" integer DEFAULT 100 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chip_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"key" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"pattern" text,
	"operator" varchar(20) DEFAULT 'contains' NOT NULL,
	"score_modifier" numeric(5, 4) DEFAULT '0.0000' NOT NULL,
	"color" varchar(20) DEFAULT 'default' NOT NULL,
	"icon" varchar(50),
	"threshold" numeric(5, 4),
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chip_filters_operator_check" CHECK ("chip_filters"."operator" IN ('contains', 'not_contains', 'equals', 'starts_with', 'regex', 'in', 'gt', 'lt', 'gte', 'lte'))
);
--> statement-breakpoint
CREATE TABLE "content_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt" text DEFAULT '{{content}}' NOT NULL,
	"variables" jsonb DEFAULT '[]' NOT NULL,
	"description" text,
	"workspace_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_templates_type_check" CHECK ("content_templates"."type" IN ('short', 'detailed', 'digest'))
);
--> statement-breakpoint
CREATE TABLE "deepsearch_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"query" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"findings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"report_text" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deepsearch_results_status_check" CHECK ("deepsearch_results"."status" IN ('pending', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "favorite_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"agent_id" uuid,
	"source_id" uuid,
	"ttl_mode" varchar(10) DEFAULT '30d' NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"score_at_favorite" numeric(5, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_articles_ttl_mode_check" CHECK ("favorite_articles"."ttl_mode" IN ('30d', 'forever'))
);
--> statement-breakpoint
CREATE TABLE "fetch_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"cron_expression" varchar(100) NOT NULL,
	"preset" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fetch_schedules_preset_check" CHECK ("fetch_schedules"."preset" IN ('every_hour', 'every_6h', 'every_day', 'custom'))
);
--> statement-breakpoint
CREATE TABLE "generated_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"template_id" uuid,
	"articles_snapshot" jsonb DEFAULT '[]' NOT NULL,
	"prompt_snapshot" text,
	"model_snapshot" varchar(100),
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_copied" boolean DEFAULT false NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_posts_type_check" CHECK ("generated_posts"."type" IN ('manual', 'digest', 'deepsearch'))
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"threshold" numeric(5, 3),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_rules_channel_check" CHECK ("notification_rules"."channel" IN ('telegram', 'email', 'web'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('collection_done', 'generation_done', 'error', 'limit_80', 'subscription_expiring', 'downgrade_complete'))
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid,
	"operation_type" varchar(100) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"status" varchar(50) NOT NULL,
	"message" text,
	"metadata" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"criterion_type" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"weight" numeric(5, 4) DEFAULT '0.0000' NOT NULL,
	"threshold" numeric(5, 4),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_criteria_type_check" CHECK ("scoring_criteria"."criterion_type" IN ('ai_relevance', 'keyword_match', 'freshness', 'source_trust', 'custom')),
	CONSTRAINT "scoring_criteria_weight_check" CHECK ("scoring_criteria"."weight" >= 0 AND "scoring_criteria"."weight" <= 1)
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(10) NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"channel_username" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"workspace_id" uuid NOT NULL,
	"fetch_schedule" varchar(100),
	"fetch_count" integer DEFAULT 0 NOT NULL,
	"last_fetch_at" timestamp with time zone,
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"fetch_status" varchar(16) DEFAULT 'never' NOT NULL,
	"health" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_type_check" CHECK ("sources"."type" IN ('rss', 'telegram'))
);
--> statement-breakpoint
CREATE TABLE "subject_areas" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(100) NOT NULL,
	"icon" varchar(50) DEFAULT 'circle' NOT NULL,
	"color" varchar(7) DEFAULT '#3b82f6' NOT NULL,
	"default_topic" text NOT NULL,
	"default_audience" text NOT NULL,
	"defaults_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"provider_payment_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'RUB' NOT NULL,
	"status" varchar(20) NOT NULL,
	"plan" varchar(10) NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sub_payments_provider_check" CHECK ("subscription_payments"."provider" IN ('yookassa')),
	CONSTRAINT "sub_payments_status_check" CHECK ("subscription_payments"."status" IN ('pending', 'succeeded', 'cancelled', 'refunded')),
	CONSTRAINT "sub_payments_plan_check" CHECK ("subscription_payments"."plan" IN ('monthly', 'yearly'))
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"limit" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_counters_type_check" CHECK ("usage_counters"."type" IN ('favorites', 'collections', 'digests', 'deepsearches', 'posts'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"name" varchar(255),
	"google_id" varchar(255),
	"yandex_id" varchar(255),
	"telegram_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_sources" ADD CONSTRAINT "agent_sources_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sources" ADD CONSTRAINT "agent_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_fingerprints" ADD CONSTRAINT "article_fingerprints_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_scores" ADD CONSTRAINT "article_scores_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_pack_id_asset_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."asset_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_packs" ADD CONSTRAINT "asset_packs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_filters" ADD CONSTRAINT "chip_filters_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deepsearch_results" ADD CONSTRAINT "deepsearch_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deepsearch_results" ADD CONSTRAINT "deepsearch_results_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_articles" ADD CONSTRAINT "favorite_articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetch_schedules" ADD CONSTRAINT "fetch_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD CONSTRAINT "generated_posts_template_id_content_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."content_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD CONSTRAINT "generated_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD CONSTRAINT "generated_posts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_unique_idx" ON "agent_sources" USING btree ("agent_id","source_id");--> statement-breakpoint
CREATE INDEX "agent_sources_agent_id_idx" ON "agent_sources" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_sources_source_id_idx" ON "agent_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "agents_workspace_id_idx" ON "agents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agents_position_idx" ON "agents" USING btree ("position");--> statement-breakpoint
CREATE INDEX "agents_subject_area_idx" ON "agents" USING btree ("subject_area");--> statement-breakpoint
CREATE UNIQUE INDEX "article_fingerprints_hash_type_unique" ON "article_fingerprints" USING btree ("fingerprint_hash","fingerprint_type");--> statement-breakpoint
CREATE INDEX "article_fingerprints_article_id_idx" ON "article_fingerprints" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "article_fingerprints_expires_idx" ON "article_fingerprints" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "article_scores_article_id_idx" ON "article_scores" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "article_scores_overall_idx" ON "article_scores" USING btree ("overall_score");--> statement-breakpoint
CREATE INDEX "article_scores_weighted_idx" ON "article_scores" USING btree ("weighted_score");--> statement-breakpoint
CREATE INDEX "articles_source_id_idx" ON "articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "articles_agent_id_idx" ON "articles" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "articles_workspace_id_idx" ON "articles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_score_idx" ON "articles" USING btree ("score");--> statement-breakpoint
CREATE INDEX "articles_is_favorite_idx" ON "articles" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_ordered_at_idx" ON "articles" USING btree ("ordered_at");--> statement-breakpoint
CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "articles_raw_hash_idx" ON "articles" USING btree ("raw_hash");--> statement-breakpoint
CREATE INDEX "articles_semantic_group_id_idx" ON "articles" USING btree ("semantic_group_id");--> statement-breakpoint
CREATE INDEX "articles_fts_idx" ON "articles" USING gin (to_tsvector('russian', "title" || ' ' || COALESCE("description", '')));--> statement-breakpoint
CREATE INDEX "asset_items_pack_id_idx" ON "asset_items" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_items_pack_name_unique" ON "asset_items" USING btree ("pack_id","name");--> statement-breakpoint
CREATE INDEX "asset_packs_workspace_id_idx" ON "asset_packs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chip_filters_agent_id_idx" ON "chip_filters" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "chip_filters_key_idx" ON "chip_filters" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "chip_filters_agent_key_unique_idx" ON "chip_filters" USING btree ("agent_id","key");--> statement-breakpoint
CREATE INDEX "content_templates_workspace_id_idx" ON "content_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_templates_type_idx" ON "content_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "deepsearch_results_workspace_id_idx" ON "deepsearch_results" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "deepsearch_results_agent_id_idx" ON "deepsearch_results" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "deepsearch_results_status_idx" ON "deepsearch_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deepsearch_results_created_at_idx" ON "deepsearch_results" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_articles_workspace_article_unique" ON "favorite_articles" USING btree ("workspace_id","article_id");--> statement-breakpoint
CREATE INDEX "favorite_articles_workspace_id_idx" ON "favorite_articles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "favorite_articles_article_id_idx" ON "favorite_articles" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "favorite_articles_expires_at_idx" ON "favorite_articles" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "fetch_schedules_workspace_id_idx" ON "fetch_schedules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "fetch_schedules_next_run_idx" ON "fetch_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "generated_posts_workspace_id_idx" ON "generated_posts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "generated_posts_agent_id_idx" ON "generated_posts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "generated_posts_template_id_idx" ON "generated_posts" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "generated_posts_type_idx" ON "generated_posts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "generated_posts_created_at_idx" ON "generated_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_rules_workspace_id_idx" ON "notification_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "notification_rules_agent_id_idx" ON "notification_rules" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "notifications_workspace_id_idx" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "oplogs_user_id_idx" ON "operation_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oplogs_workspace_id_idx" ON "operation_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "oplogs_agent_id_idx" ON "operation_logs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "oplogs_status_idx" ON "operation_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "oplogs_created_at_idx" ON "operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "scoring_criteria_agent_id_idx" ON "scoring_criteria" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "scoring_criteria_type_idx" ON "scoring_criteria" USING btree ("criterion_type");--> statement-breakpoint
CREATE INDEX "sources_workspace_id_idx" ON "sources" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sources_type_idx" ON "sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sources_is_active_idx" ON "sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sources_fetch_status_idx" ON "sources" USING btree ("fetch_status");--> statement-breakpoint
CREATE INDEX "subject_areas_position_idx" ON "subject_areas" USING btree ("position");--> statement-breakpoint
CREATE INDEX "sub_payments_workspace_id_idx" ON "subscription_payments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sub_payments_status_idx" ON "subscription_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_counters_workspace_type_idx" ON "usage_counters" USING btree ("workspace_id","type");--> statement-breakpoint
CREATE INDEX "usage_counters_period_idx" ON "usage_counters" USING btree ("period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_yandex_id_idx" ON "users" USING btree ("yandex_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_id_idx" ON "users" USING btree ("telegram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_user_id_idx" ON "workspaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_plan_idx" ON "workspaces" USING btree ("plan");