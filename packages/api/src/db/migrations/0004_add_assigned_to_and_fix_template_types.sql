-- Migration 0004: Add assignedTo column + fix content_templates type values
-- This migration is fully idempotent and safe to re-run.

-- Step 1: Add assignedTo column to ai_providers (idempotent — IF NOT EXISTS)
ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "assigned_to" jsonb DEFAULT '[]' NOT NULL;

-- Step 2: Migrate existing content_templates rows: 'short' and 'detailed' → 'post'
-- This MUST happen before changing the CHECK constraint, otherwise rows with old type values
-- would violate the new constraint and cause the migration (and server startup) to fail.
-- This UPDATE is idempotent — if type is already 'post', it's a no-op.
UPDATE "content_templates" SET "type" = 'post' WHERE "type" IN ('short', 'detailed');

-- Step 3: Update content_templates type constraint (idempotent — DROP IF EXISTS first)
ALTER TABLE "content_templates" DROP CONSTRAINT IF EXISTS "content_templates_type_check";
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_type_check" CHECK ("type" IN ('post', 'digest'));
