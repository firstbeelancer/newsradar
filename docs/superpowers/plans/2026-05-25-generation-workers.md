# Generation Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move post and digest generation out of the API process and into BullMQ workers, keeping the existing frontend API contract.

**Architecture:** The API prepares prompt/article/template snapshots, creates an operation log, stores initial generation state in Redis, and enqueues `generate-post` or `generate-digest`. The worker performs the AI request, publishes progress to Redis for the existing SSE endpoint, persists `generated_posts`, and finalizes `operation_logs`.

**Tech Stack:** Node.js, Express, TypeScript, BullMQ, Redis pub/sub, Drizzle ORM, OpenAI-compatible AI adapter.

---

### Task 1: Redis-backed generation state

**Files:**
- Create: `packages/api/src/modules/generation/progress.ts`
- Modify: `packages/api/src/modules/generation/routes.ts`

- [x] Add a small API-side helper that stores generation operation state under `newsradar:generation:state:{operationId}` with a one-hour TTL and subscribes to `newsradar:generation:{operationId}`.
- [x] Replace `/api/v1/generation/stream/:operationId` polling of the in-memory `streamStore` with Redis current-state read plus pub/sub updates.
- [x] Keep response shape unchanged: `{ status, content, chunks, error }`.

### Task 2: API producer instead of API executor

**Files:**
- Modify: `packages/api/src/modules/generation/service.ts`
- Modify: `packages/api/src/lib/queues.ts`

- [x] Keep article/template selection, prompt rendering, compact regeneration prompt, hashtag feedback handling, emoji mapping, and operation log creation in the API.
- [x] Remove direct `fetch`/AbortController AI execution from the API service.
- [x] Enqueue `generate-post` for manual/deepsearch post generation and `generate-digest` for digests with `operationId`, `operationLogId`, `userId`, prompt snapshot, model/provider request, article snapshots, and output sanitization flags.
- [x] Return `{ operationId, status: "queued" }` as before so the frontend keeps working.

### Task 3: Worker runtime for prepared generation jobs

**Files:**
- Create: `packages/worker/src/workers/generation-runtime.ts`
- Modify: `packages/worker/src/workers/generate-post.worker.ts`
- Modify: `packages/worker/src/workers/generate-digest.worker.ts`

- [x] Add a shared worker function that receives a prepared generation job.
- [x] Publish `pending`, `generating`, `completed`, and `error` states to Redis pub/sub and the Redis state key.
- [x] Call `streamComplete`; if streaming returns no useful text, retry through `complete`.
- [x] Sanitize Telegram text, enforce leading emoji, and preserve explicit hashtags only when feedback requested them.
- [x] Insert the generated row into `generated_posts`.
- [x] Update the existing operation log to `running`, `completed`, or `error`.

### Task 4: Verification and rollout

**Files:**
- No source files unless tests expose a defect.

- [x] Run API and worker typechecks.
- [x] Run focused generation tests where available.
- [ ] Commit and push to `main`.
- [ ] Let Coolify deploy from `main`.
- [ ] Smoke-test login, article generation, regeneration with "add original link and tags", and generation history.
- [ ] Update TigerWiki with the root cause and deployed fix.
