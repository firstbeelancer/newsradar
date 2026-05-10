-- ─────────────────────────────────────────────────────────────
-- Delta migration: add missing columns after v3.2 audit
-- Target DB: newsradar (production)
-- Date: 2026-05-09
-- ─────────────────────────────────────────────────────────────

-- 1. agents.config — JSONB с настройками агента (scoring_weights, chip_filters, gpt_prompts, asset_pack, fetch_schedule)
ALTER TABLE "agents"
  ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- 2. content_templates.position — порядковый номер шаблона
ALTER TABLE "content_templates"
  ADD COLUMN "position" integer DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS "content_templates_position_idx" ON "content_templates" ("position");

-- 3. sources.fetch_schedule — cron-выражение для расписания сбора
ALTER TABLE "sources"
  ADD COLUMN "fetch_schedule" varchar(100);

-- 4. content_templates — уникальность (workspace_id, type) для одного дефолта по типу
-- (опционально, зависит от бизнес-логики — оставляем на данный момент)

-- 5. notification_rules.channel — расширяем с varchar(20) на jsonb[] для множественного выбора
-- ВНИМАНИЕ: это BREAKING CHANGE для существующих данных.
-- Оставляем как есть (varchar(20)) до реализации UI настроек уведомлений.
-- Миграция на JSONB будет отдельно, когда будет готов UI.