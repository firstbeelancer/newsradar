-- Add assignedTo column to ai_providers for tracking which operations use this provider
ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "assigned_to" jsonb DEFAULT '[]' NOT NULL;

-- Migrate existing content_templates rows: 'short' and 'detailed' → 'post', keep 'digest' as-is
-- This MUST happen before changing the CHECK constraint, otherwise rows with old type values
-- would violate the new constraint and cause the migration (and server startup) to fail.
UPDATE "content_templates" SET "type" = 'post' WHERE "type" IN ('short', 'detailed');

-- Update content_templates type constraint: allow 'post' and 'digest' instead of 'short', 'detailed', 'digest'
ALTER TABLE "content_templates" DROP CONSTRAINT IF EXISTS "content_templates_type_check";
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_type_check" CHECK ("type" IN ('post', 'digest'));
