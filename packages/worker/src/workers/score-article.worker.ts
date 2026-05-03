/**
 * ------------------------------------------------------------------
 * Worker: score-article
 * ------------------------------------------------------------------
 * Runs 4 scoring criteria (ai_relevance, keyword_match, freshness,
 * source_trust), computes weighted score, writes article_scores,
 * updates article.score and status='scored', determines chips.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import {
  articles,
  articleScores,
  agents,
  sources,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import {
  scoreArticle,
  DEFAULT_WEIGHTS,
  extractKeywords,
  type ScoringWeights,
  type ScoreResult,
} from "../lib/scorer.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface ScoreArticleJob {
  articleId: string;
}

/**
 * Load workspace-specific scoring weights.
 * Falls back to defaults if no custom config exists.
 */
async function getWorkspaceWeights(workspaceId: string): Promise<ScoringWeights> {
  // TODO: Load from workspace_config table when implemented
  // For now, use defaults
  void workspaceId;
  return DEFAULT_WEIGHTS;
}

/**
 * Resolve agent topic for keyword matching.
 */
async function resolveAgentTopic(agentId: string): Promise<string | undefined> {
  const result = await db
    .select({ name: agents.name, description: agents.description })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const agent = result[0];
  if (!agent) return undefined;
  return `${agent.name} ${agent.description ?? ""}`.trim();
}

/**
 * Process a score-article job.
 */
export async function processScoreArticle(
  job: Job<ScoreArticleJob>,
  logger: Logger
): Promise<ScoreResult & { articleId: string }> {
  const { articleId } = job.data;

  logger.debug({ articleId, jobId: job.id }, "Processing article scoring");

  // Load article with agent info
  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      publishedAt: articles.publishedAt,
      sourceId: articles.sourceId,
      agentId: articles.agentId,
      workspaceId: articles.workspaceId,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Load scoring configuration
  const [weights, agentTopic] = await Promise.all([
    getWorkspaceWeights(article.workspaceId),
    resolveAgentTopic(article.agentId),
  ]);

  const keywords = agentTopic ? extractKeywords(agentTopic) : [];

  logger.debug(
    { articleId, keywords: keywords.length, weights },
    "Scoring configuration loaded"
  );

  // Run scoring
  const scoreResult = await scoreArticle(articleId, {
    agentTopic,
    keywords,
    weights,
  });

  // Upsert article_scores record
  const scoredAt = new Date();

  const existingScore = await db
    .select({ id: articleScores.id })
    .from(articleScores)
    .where(eq(articleScores.articleId, articleId))
    .limit(1);

  if (existingScore[0]) {
    await db
      .update(articleScores)
      .set({
        aiRelevance: scoreResult.aiRelevance.toFixed(2),
        keywordMatch: scoreResult.keywordMatch.toFixed(2),
        freshness: scoreResult.freshness.toFixed(2),
        sourceTrust: scoreResult.sourceTrust.toFixed(2),
        overallScore: scoreResult.overallScore.toFixed(3),
        weightedScore: scoreResult.weightedScore.toFixed(3),
        weightsSnapshot: weights as unknown as Record<string, unknown>,
        chips: scoreResult.chips,
        scoredAt,
      })
      .where(eq(articleScores.id, existingScore[0].id));
  } else {
    await db.insert(articleScores).values({
      articleId,
      aiRelevance: scoreResult.aiRelevance.toFixed(2),
      keywordMatch: scoreResult.keywordMatch.toFixed(2),
      freshness: scoreResult.freshness.toFixed(2),
      sourceTrust: scoreResult.sourceTrust.toFixed(2),
      overallScore: scoreResult.overallScore.toFixed(3),
      weightedScore: scoreResult.weightedScore.toFixed(3),
      weightsSnapshot: weights as unknown as Record<string, unknown>,
      chips: scoreResult.chips,
      scoredAt,
    });
  }

  // Update article score and status
  await db
    .update(articles)
    .set({
      score: scoreResult.weightedScore.toFixed(3),
      status: "scored",
      updatedAt: scoredAt,
    })
    .where(eq(articles.id, articleId));

  logger.info(
    {
      articleId,
      weightedScore: scoreResult.weightedScore,
      overallScore: scoreResult.overallScore,
      chips: scoreResult.chips,
    },
    "Article scored successfully"
  );

  return { ...scoreResult, articleId };
}
