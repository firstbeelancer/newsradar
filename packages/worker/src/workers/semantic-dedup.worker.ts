/**
 * ------------------------------------------------------------------
 * Worker: semantic-dedup
 * ------------------------------------------------------------------
 * Searches for semantically similar articles via pg_trgm.
 * If similarity > 0.7 → assigns semantic_group_id, status='deduped'.
 * If unique → queues for score-article.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { articles } from "../../api/src/db/schema.js";
import { eq } from "drizzle-orm";
import { findSemanticDuplicates, assignSemanticGroup } from "../lib/dedup.js";
import { scoreArticleQueue } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface SemanticDedupJob {
  articleId: string;
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
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Skip if already part of a semantic group
  if (article.semanticGroupId) {
    logger.debug({ articleId, groupId: article.semanticGroupId }, "Already in semantic group");
    return { status: "deduped", matches: 1, groupId: article.semanticGroupId };
  }

  // Find semantically similar articles
  const matches = await findSemanticDuplicates(
    articleId,
    article.title,
    0.7,
    article.workspaceId,
    article.agentId
  );

  if (matches.length > 0) {
    // Found similar articles — use the first match's group or create one
    const topMatch = matches[0];
    const groupId = topMatch.id; // Use the most similar article's ID as group ID

    logger.info(
      { articleId, groupId, similarity: topMatch.similarity, matchCount: matches.length },
      "Semantic duplicate found, assigning to group"
    );

    await assignSemanticGroup(articleId, groupId);

    return { status: "deduped", matches: matches.length, groupId };
  }

  // Unique article — queue for scoring
  logger.debug({ articleId }, "No semantic duplicates, queuing for scoring");

  await scoreArticleQueue.add(
    `score-article-${articleId}`,
    { articleId },
    { jobId: `score-article-${articleId}` }
  );

  return { status: "scored", matches: 0 };
}
