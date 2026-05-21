-- Migration 0004: Add assignedTo column + fix content_templates type values
-- This migration is fully idempotent and safe to re-run.

-- Step 1: Add assignedTo column to ai_providers (idempotent — IF NOT EXISTS)
ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "assigned_to" jsonb DEFAULT '[]' NOT NULL;

-- Step 2: Drop the old type constraint so existing rows can be migrated safely.
-- The previous constraint only allowed ('short', 'detailed', 'digest'), so updating
-- rows to 'post' before dropping it causes PostgreSQL to reject the UPDATE itself.
ALTER TABLE "content_templates" DROP CONSTRAINT IF EXISTS "content_templates_type_check";

-- Step 3: Migrate existing content_templates rows: 'short' and 'detailed' → 'post'
-- This UPDATE is idempotent — if type is already 'post', it's a no-op.
UPDATE "content_templates" SET "type" = 'post' WHERE "type" IN ('short', 'detailed');

-- Step 4: Add the new type constraint after the data matches the new enum.
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_type_check" CHECK ("type" IN ('post', 'digest'));
