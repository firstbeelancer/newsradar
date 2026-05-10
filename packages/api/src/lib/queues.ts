/**
 * Centralized BullMQ queue registry.
 * Single source of truth — all queues are created here.
 * Workers and producers both import from this file.
 */
import { Queue } from "bullmq";
import { getRedisConnection } from "./redis.js";

let _fetchSourceQueue: Queue | null = null;
let _rawDedupQueue: Queue | null = null;
let _translateQueue: Queue | null = null;
let _semanticDedupQueue: Queue | null = null;
let _ingestAnalysisQueue: Queue | null = null;
let _scoreArticleQueue: Queue | null = null;
let _generatePostQueue: Queue | null = null;
let _generateDigestQueue: Queue | null = null;
let _deepsearchQueue: Queue | null = null;
let _cleanupQueue: Queue | null = null;
let _favoritesCleanupQueue: Queue | null = null;
let _postsCleanupQueue: Queue | null = null;
let _heartbeatQueue: Queue | null = null;

function createQueue(name: string): Queue {
  return new Queue(name, { connection: getRedisConnection() });
}

export function getFetchSourceQueue(): Queue {
  if (!_fetchSourceQueue) _fetchSourceQueue = createQueue("fetch-source");
  return _fetchSourceQueue;
}

export function getRawDedupQueue(): Queue {
  if (!_rawDedupQueue) _rawDedupQueue = createQueue("raw-dedup");
  return _rawDedupQueue;
}

export function getTranslateQueue(): Queue {
  if (!_translateQueue) _translateQueue = createQueue("translate");
  return _translateQueue;
}

export function getSemanticDedupQueue(): Queue {
  if (!_semanticDedupQueue) _semanticDedupQueue = createQueue("semantic-dedup");
  return _semanticDedupQueue;
}

export function getIngestAnalysisQueue(): Queue {
  if (!_ingestAnalysisQueue) _ingestAnalysisQueue = createQueue("ingest-analysis");
  return _ingestAnalysisQueue;
}

export function getScoreArticleQueue(): Queue {
  if (!_scoreArticleQueue) _scoreArticleQueue = createQueue("score-article");
  return _scoreArticleQueue;
}

export function getGeneratePostQueue(): Queue {
  if (!_generatePostQueue) _generatePostQueue = createQueue("generate-post");
  return _generatePostQueue;
}

export function getGenerateDigestQueue(): Queue {
  if (!_generateDigestQueue) _generateDigestQueue = createQueue("generate-digest");
  return _generateDigestQueue;
}

export function getDeepsearchQueue(): Queue {
  if (!_deepsearchQueue) _deepsearchQueue = createQueue("deepsearch");
  return _deepsearchQueue;
}

export function getCleanupQueue(): Queue {
  if (!_cleanupQueue) _cleanupQueue = createQueue("cleanup");
  return _cleanupQueue;
}

export function getFavoritesCleanupQueue(): Queue {
  if (!_favoritesCleanupQueue) _favoritesCleanupQueue = createQueue("favorites-cleanup");
  return _favoritesCleanupQueue;
}

export function getPostsCleanupQueue(): Queue {
  if (!_postsCleanupQueue) _postsCleanupQueue = createQueue("posts-cleanup");
  return _postsCleanupQueue;
}

export function getHeartbeatQueue(): Queue {
  if (!_heartbeatQueue) _heartbeatQueue = createQueue("heartbeat");
  return _heartbeatQueue;
}

/** Get all queues (for health checks, etc.) */
export function getAllQueues(): Queue[] {
  return [
    getFetchSourceQueue(),
    getRawDedupQueue(),
    getTranslateQueue(),
    getSemanticDedupQueue(),
    getIngestAnalysisQueue(),
    getScoreArticleQueue(),
    getGeneratePostQueue(),
    getGenerateDigestQueue(),
    getDeepsearchQueue(),
    getCleanupQueue(),
    getFavoritesCleanupQueue(),
    getPostsCleanupQueue(),
    getHeartbeatQueue(),
  ];
}
