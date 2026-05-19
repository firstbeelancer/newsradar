-- Add assignedTo column to ai_providers for tracking which operations use this provider
ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "assigned_to" jsonb DEFAULT '[]' NOT NULL;

-- Update content_templates type constraint: allow 'post' and 'digest' instead of 'short', 'detailed', 'digest'
ALTER TABLE "content_templates" DROP CONSTRAINT IF EXISTS "content_templates_type_check";
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_type_check" CHECK ("type" IN ('post', 'digest'));
