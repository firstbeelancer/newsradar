/**
 * ------------------------------------------------------------------
 * Worker: raw-dedup
 * ------------------------------------------------------------------
 * Computes raw hash (MD5 of url+title) and checks uniqueness.
 * If duplicate → marks status='deduped'.
 * If unique → queues for translation.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { articles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { computeRawHash, findByRawHash } from "../lib/dedup.js";
import { translateQueue } from "../connection/redis.js";
import { buildRawDuplicateState } from "./pipeline-state.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface RawDedupJob {
  articleId: string;
}

/**
 * Process a raw-dedup job.
 */
export async function processRawDedup(
  job: Job<RawDedupJob>,
  logger: Logger
): Promise<{ status: "deduped" | "translated"; hash: string }> {
  const { articleId } = job.data;

  logger.debug({ articleId, jobId: job.id }, "Processing raw dedup");

  // Load article
  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      link: articles.link,
      guid: articles.guid,
      rawHash: articles.rawHash,
      agentId: articles.agentId,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Compute raw hash if not already set
  let rawHash = article.rawHash;
  if (!rawHash) {
    rawHash = article.guid
      ? `guid:${computeRawHash(article.guid, "")}`
      : computeRawHash(article.link, article.title);
  }

  // Check for an existing article with the same hash *within the same agent*.
  // A source attached to several agents intentionally produces one copy per
  // agent so each thematic feed scores it against its own tags and weights;
  // a global check would silently delete every copy but the first.
  const existing = await findByRawHash(rawHash, article.agentId);
  if (existing && existing.id !== articleId) {
    // Duplicate found — mark as deduped
    logger.info(
      { articleId, existingId: existing.id, hash: rawHash },
      "Duplicate article found, marking as deduped"
    );

    await db
      .update(articles)
      .set(buildRawDuplicateState(rawHash))
      .where(eq(articles.id, articleId));

    return { status: "deduped", hash: rawHash };
  }

  // Unique article — update hash and queue for translation
  await db
    .update(articles)
    .set({
      rawHash,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, articleId));

  await translateQueue.add(
    `translate-${articleId}`,
    { articleId },
    { jobId: `translate-${articleId}` }
  );

  logger.debug({ articleId, hash: rawHash }, "Article is unique, queued for translation");

  return { status: "translated", hash: rawHash };
}
