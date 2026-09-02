-- Translation failure tracking.
--
-- Before this, an article whose translation kept failing was reset to
-- (status='fetched', needs_translation=true) on every attempt and re-queued by
-- the heartbeat forever. It never reached the feed and the status bar showed
-- "Перевод" as permanently stuck. These columns let the worker give up after a
-- bounded number of attempts and surface the reason instead.

ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "translation_attempts" integer DEFAULT 0 NOT NULL;

ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "translation_error" text;

CREATE INDEX IF NOT EXISTS "articles_translation_attempts_idx"
  ON "articles" ("translation_attempts");

-- Retire the pre-existing backlog: rows that have been sitting in the
-- translation queue for over a day are marked as exhausted so they stop being
-- re-queued every minute. The worker will still translate them on demand
-- (article "Перевести" button / manual retry), it just no longer loops.
UPDATE "articles"
SET "translation_attempts" = 5,
    "translation_error" = COALESCE("translation_error", 'Перевод не удался до перезапуска пайплайна'),
    "needs_translation" = false,
    "status" = 'translated'
WHERE "needs_translation" = true
  AND "status" IN ('new', 'fetched')
  AND "updated_at" < NOW() - INTERVAL '1 day';
