-- xAI Grok OAuth (SuperGrok / X Premium+) connections per workspace.
-- Stores encrypted tokens from device-code login (Hermes-compatible flow).

CREATE TABLE IF NOT EXISTS "xai_oauth_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" varchar(32) NOT NULL DEFAULT 'disconnected',
  -- pending device-code session
  "device_code" text,
  "user_code" varchar(64),
  "verification_uri" text,
  "verification_uri_complete" text,
  "device_interval_sec" integer DEFAULT 5,
  "device_expires_at" timestamptz,
  -- tokens (encrypted AES-GCM same as ai_providers keys)
  "access_token_encrypted" text,
  "refresh_token_encrypted" text,
  "id_token_encrypted" text,
  "token_type" varchar(32) DEFAULT 'Bearer',
  "expires_at" timestamptz,
  "token_endpoint" text,
  "base_url" text DEFAULT 'https://api.x.ai/v1',
  "last_error" text,
  "connected_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "xai_oauth_connections_workspace_uidx"
  ON "xai_oauth_connections" ("workspace_id");

CREATE INDEX IF NOT EXISTS "xai_oauth_connections_status_idx"
  ON "xai_oauth_connections" ("status");

ALTER TABLE "xai_oauth_connections" DROP CONSTRAINT IF EXISTS "xai_oauth_connections_status_check";
ALTER TABLE "xai_oauth_connections" ADD CONSTRAINT "xai_oauth_connections_status_check"
  CHECK ("status" IN ('disconnected', 'pending', 'connected', 'error'));

-- Allow oauth type on ai_providers for Grok subscription connection marker
ALTER TABLE "ai_providers" DROP CONSTRAINT IF EXISTS "ai_providers_type_check";
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_type_check"
  CHECK ("type" IN ('platform', 'byok', 'oauth'));
