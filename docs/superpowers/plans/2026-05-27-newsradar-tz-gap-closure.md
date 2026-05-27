# NewsRadar TZ Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the selected NewsRadar TZ gaps: SPA fallback, safe external fetch, generated-post FTS, favorite records, AI provider operations, DeepSearch web providers, and generation/DeepSearch snapshots.

**Architecture:** Keep changes backward-compatible because production already has data. Add nullable TZ fields and migrations first, then write/read both old and new shapes until the UI can be fully migrated. Centralize risky external HTTP in one safe-fetch helper and reuse it from ingestion and DeepSearch extraction.

**Tech Stack:** Vite/React, Express/TypeScript, Drizzle/PostgreSQL, BullMQ worker, nginx, Vitest.

---

### Task 1: SPA Fallback

**Files:**
- Modify: `packages/web/nginx.conf`
- Test: `packages/web/__tests__/web.test.ts`

- [ ] Verify nginx routes all non-asset, non-API paths to `/index.html`.
- [ ] Add a regression test that checks `/history`, `/settings`, and `/notifications` are represented as SPA routes in the app router.
- [ ] Build web and verify the production nginx config is copied into the image.

### Task 2: Safe External Fetch

**Files:**
- Create: `packages/worker/src/lib/safe-fetch.ts`
- Test: `packages/worker/__tests__/safe-fetch.test.ts`
- Modify: `packages/worker/src/lib/rss-parser.ts`
- Modify: `packages/worker/src/lib/telegram-parser.ts`
- Modify: `packages/worker/src/lib/article-extractor.ts`

- [ ] Write tests for allowed HTTP/HTTPS URLs, blocked localhost/private/metadata URLs, timeout, response-size cap, and safe text/json helpers.
- [ ] Implement URL normalization, DNS private-IP checks, redirect limits, timeout, response-size limit, and safe User-Agent.
- [ ] Replace direct ingestion/extraction `fetch` calls with safe-fetch.

### Task 3: Generated Posts FTS

**Files:**
- Modify: `packages/api/src/db/schema.ts`
- Modify: `packages/worker/src/db/schema.ts`
- Create migration under `packages/api/src/db/migrations/`

- [ ] Add a GIN index over `generated_posts` text, using the new generated/edited text fields with old `content` fallback.
- [ ] Keep the search endpoint backward-compatible.

### Task 4: Favorites Model

**Files:**
- Modify: `packages/api/src/modules/articles/service.ts`
- Modify: `packages/worker/src/workers/cleanup.worker.ts`
- Modify: `packages/worker/src/workers/favorites-cleanup.worker.ts`
- Test: API article/favorites tests.

- [ ] Insert/delete `favorite_articles` rows when the user favorites/unfavorites.
- [ ] Keep `articles.is_favorite` as a denormalized compatibility flag.
- [ ] Enforce Free/Pro favorite limits from workspace plan.
- [ ] Make cleanup preserve rows present in `favorite_articles` and expire `30d` favorites.

### Task 5: AI Provider Operations

**Files:**
- Modify: `packages/api/src/modules/ai-providers/service.ts`
- Modify: `packages/api/src/modules/ai-providers/routes.ts`
- Create: `scripts/reencrypt-keys.ts`
- Test: AI provider route tests.

- [ ] Add `POST /api/v1/ai-providers/:id/duplicate`.
- [ ] Add `POST /api/v1/ai-providers/assign`.
- [ ] Add key re-encryption script using `OLD_ENCRYPTION_KEY` and current `ENCRYPTION_KEY`.

### Task 6: DeepSearch Web Providers

**Files:**
- Modify: `packages/worker/src/lib/web-search.ts`
- Modify: `packages/api/src/modules/deepsearch/routes.ts`
- Modify: `packages/web/src/features/settings/deepsearch-settings.tsx`
- Test: `packages/worker/__tests__/web-search.test.ts`

- [ ] Keep Brave as current default supported web-search provider.
- [ ] Add Perplexity-compatible search via chat/completions JSON extraction.
- [ ] Add Grok/OpenAI-compatible search mode through the same compatible adapter.
- [ ] Keep Tavily/SerpAPI selectable only if implemented or label them as saved-but-not-tested.

### Task 7: Generated/DeepSearch Snapshots

**Files:**
- Modify: `packages/api/src/db/schema.ts`
- Modify: `packages/worker/src/db/schema.ts`
- Modify: generation services/workers.
- Modify: deepsearch service/worker.
- Create migration under `packages/api/src/db/migrations/`

- [ ] Add nullable TZ fields to `generated_posts`: `generated_text`, `edited_text`, `article_ids`, JSONB snapshots, `copied_at`, `status`.
- [ ] Add nullable TZ fields to `deepsearch_results`: `article_id`, `user_id`, `ai_provider_id`, `completed_at`, `failed_at`, `error_message`.
- [ ] Populate new fields while keeping old `content`, `prompt_snapshot`, and `findings` compatibility.
- [ ] Update copy/edit logic to use `copied_at` and `edited_text`.

### Task 8: Verification and Docs

**Files:**
- TigerWiki project `newsradar`

- [ ] Run focused API/worker/web tests.
- [ ] Run web build and available backend checks.
- [ ] Push to `origin/main`.
- [ ] Verify production health and selected browser/API smoke.
- [ ] Write a progress note to TigerWiki with commit, deploy bundle, tests, and remaining caveats.
