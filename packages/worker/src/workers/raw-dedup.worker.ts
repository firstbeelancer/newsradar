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
import { articles } from "../../api/src/db/schema.js";
import { eq } from "drizzle-orm";
import { computeRawHash, findByRawHash } from "../lib/dedup.js";
import { translateQueue } from "../connection/redis.js";
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

  // Check for existing article with same hash (excluding self)
  const existing = await findByRawHash(rawHash);
  if (existing && existing.id !== articleId) {
    // Duplicate found — mark as deduped
    logger.info(
      { articleId, existingId: existing.id, hash: rawHash },
      "Duplicate article found, marking as deduped"
    );

    await db
      .update(articles)
      .set({
        status: "deduped",
        rawHash,
        updatedAt: new Date(),
      })
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
