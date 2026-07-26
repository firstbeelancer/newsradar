/**
 * ------------------------------------------------------------------
 * Worker: semantic-dedup
 * ------------------------------------------------------------------
 * Searches for semantically similar articles via pg_trgm.
 * Always advances pipeline: status → analyzed, then score-article.
 * (Previously duplicates stayed status=translated forever → fake «Саммари зависло».)
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { articles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { findSemanticDuplicates, assignSemanticGroup, type SemanticMatch } from "../lib/dedup.js";
import { scoreArticleQueue } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface SemanticDedupJob {
  articleId: string;
}

async function queueScoring(articleId: string, logger: Logger): Promise<void> {
  // Mark analyzed so status-bar «Саммари» backlog clears once we leave translate stage.
  await db
    .update(articles)
    .set({ status: "analyzed", updatedAt: new Date() })
    .where(eq(articles.id, articleId));

  const jobId = `score-article-${articleId}-${Date.now()}`;
  await scoreArticleQueue.add(
    jobId,
    { articleId },
    {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 8_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    }
  );
  logger.debug({ articleId, jobId }, "Queued scoring after semantic-dedup");
}

/**
 * Process a semantic-dedup job.
 */
export async function processSemanticDedup(
  job: Job<SemanticDedupJob>,
  logger: Logger
): Promise<{
  status: "deduped" | "scored";
  matches: number;
  groupId?: string;
}> {
  const { articleId } = job.data;

  logger.debug({ articleId, jobId: job.id }, "Processing semantic dedup");

  // Load article
  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      workspaceId: articles.workspaceId,
      agentId: articles.agentId,
      semanticGroupId: articles.semanticGroupId,
      status: articles.status,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Already fully scored — nothing to do.
  if (article.status === "scored") {
    return { status: "scored", matches: 0, groupId: article.semanticGroupId ?? undefined };
  }

  // Already grouped — still must reach scoring (was the stuck-summary root cause).
  if (article.semanticGroupId) {
    logger.debug({ articleId, groupId: article.semanticGroupId }, "Already in semantic group → score");
    await queueScoring(articleId, logger);
    return { status: "deduped", matches: 1, groupId: article.semanticGroupId };
  }

  let matches: SemanticMatch[] = [];
  try {
    matches = await findSemanticDuplicates(
      articleId,
      article.title,
      0.7,
      article.workspaceId,
      article.agentId
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(
      { articleId, err: errorMessage },
      "Semantic dedup failed, falling back to scoring"
    );
  }

  if (matches.length > 0) {
    const topMatch = matches[0];
    const groupId = topMatch.id;

    logger.info(
      { articleId, groupId, similarity: topMatch.similarity, matchCount: matches.length },
      "Semantic duplicate found, assigning to group then scoring"
    );

    await assignSemanticGroup(articleId, groupId);
    await queueScoring(articleId, logger);
    return { status: "deduped", matches: matches.length, groupId };
  }

  logger.debug({ articleId }, "No semantic duplicates, queuing for scoring");
  await queueScoring(articleId, logger);
  return { status: "scored", matches: 0 };
}
