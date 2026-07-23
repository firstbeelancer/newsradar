-- Allow xAI (Grok) as a first-class AI provider (OpenAI-compatible API).
-- Auth for Grok/xAI is API-key based (BYOK), not OAuth.

ALTER TABLE "ai_providers" DROP CONSTRAINT IF EXISTS "ai_providers_provider_check";
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_provider_check"
  CHECK ("provider" IN ('openai', 'anthropic', 'openrouter', 'google', 'xai'));
