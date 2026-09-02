-- Auto-quarantine for permanently dead sources.
--
-- error_count is cumulative and only feeds scoreSourceTrust, so nothing ever
-- took a dead source out of rotation: a 404 feed kept burning three attempts
-- with exponential backoff on every single collection run, forever. On the
-- owner's workspace that showed up as 387 failed fetch jobs against 2637
-- completed.
--
-- A separate consecutive counter is needed because error_count must stay
-- cumulative for the trust score to mean anything.

ALTER TABLE "sources"
  ADD COLUMN IF NOT EXISTS "consecutive_error_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "sources"
  ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "sources_consecutive_error_count_idx"
  ON "sources" ("consecutive_error_count");

-- Seed the counter for sources that are already failing, so quarantine kicks in
-- on the next run instead of waiting for a fresh streak to build up.
UPDATE "sources"
SET "consecutive_error_count" = LEAST("error_count", 5)
WHERE "fetch_status" = 'error';
