import { createQueue } from "./connection/bullmq.js";

/**
 * ------------------------------------------------------------------
 * Queue registry — single source of truth for all BullMQ queues.
 * ------------------------------------------------------------------
 *
 * Pipeline queues (data flow):
 *   1. fetch-source      — RSS / API fetching for each news source
 *   2. raw-dedup         — Deduplicate raw articles by URL hash
 *   3. translate         — Translate non-Russian content to Russian
 *   4. semantic-dedup    — Semantic deduplication via embeddings
 *   5. ingest-analysis   — Store article + run NLP analysis
 *   6. score-article     — AI scoring (relevance, quality, etc.)
 *   7. generate-post     — Create social-media post from article
 *   8. generate-digest   — Compile daily / weekly digest
 *
 * Utility queues:
 *   9. deepsearch        — Background deep research tasks
 *  10. cleanup          — Periodic cleanup of old jobs / data
 *  11. favorites-cleanup — Remove stale favorites references
 *  12. posts-cleanup    — Remove old generated posts
 *
 * ------------------------------------------------------------------
 */

/** 1. Fetch raw content from RSS feeds and external APIs. */
export const fetchSourceQueue = createQueue("fetch-source");

/** 2. Deduplicate articles by raw URL / content hash. */
export const rawDedupQueue = createQueue("raw-dedup");

/** 3. Translate article content to Russian when needed. */
export const translateQueue = createQueue("translate");

/** 4. Semantic deduplication using vector embeddings. */
export const semanticDedupQueue = createQueue("semantic-dedup");

/** 5. Persist article to DB and trigger NLP enrichment. */
export const ingestAnalysisQueue = createQueue("ingest-analysis");

/** 6. AI-powered scoring of article relevance & quality. */
export const scoreArticleQueue = createQueue("score-article");

/** 7. Generate social-media post from scored article. */
export const generatePostQueue = createQueue("generate-post");

/** 8. Compile daily / weekly digest of top articles. */
export const generateDigestQueue = createQueue("generate-digest");

/** 9. Deep research background jobs. */
export const deepsearchQueue = createQueue("deepsearch");

/** 10. General cleanup of expired jobs and temporary data. */
export const cleanupQueue = createQueue("cleanup");

/** 11. Cleanup of stale favorite references. */
export const favoritesCleanupQueue = createQueue("favorites-cleanup");

/** 12. Cleanup of old generated posts. */
export const postsCleanupQueue = createQueue("posts-cleanup");

/**
 * All queues as an array — useful for bulk operations (pause, resume, close).
 */
export const allQueues = [
  fetchSourceQueue,
  rawDedupQueue,
  translateQueue,
  semanticDedupQueue,
  ingestAnalysisQueue,
  scoreArticleQueue,
  generatePostQueue,
  generateDigestQueue,
  deepsearchQueue,
  cleanupQueue,
  favoritesCleanupQueue,
  postsCleanupQueue,
];
