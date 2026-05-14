-- Add config JSONB column to workspaces table for storing custom prompts and other workspace-level settings
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "config" jsonb NOT NULL DEFAULT '{}';
