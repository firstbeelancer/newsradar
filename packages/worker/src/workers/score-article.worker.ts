/**
 * ------------------------------------------------------------------
 * Worker: score-article (hybrid model v2)
 * ------------------------------------------------------------------
 * Hybrid formula:
 *   final = ai_score×0.55 + keyword×0.20 + freshness×0.15 + source_trust×0.10
 *
 * AI evaluates 5 criteria (relevance, novelty, hype, practical, local).
 * Agent-specific weights control the AI sub-score.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import {
  articles,
  articleScores,
  agents,
} from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  scoreArticle,
  loadAgentWeights,
  extractKeywords,
  type ScoreResult,
} from "../lib/scorer.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface ScoreArticleJob {
  articleId: string;
}

/**
 * Resolve agent topic and tone for scoring.
 */
async function resolveAgentContext(agentId: string): Promise<{
  topic?: string;
  tone?: string;
}> {
  const result = await db
    .select({ name: agents.name, description: agents.description, config: agents.config })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const agent = result[0];
  if (!agent) return {};

  const config = (agent.config as Record<string, unknown>) ?? {};
  const topic = `${agent.name} ${agent.description ?? ""}`.trim();
  const tone = (config.tone as string) ?? "professional";

  return { topic, tone };
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

  // Load article
  const articleRow = await db
    .select({
      id: articles.id,
      agentId: articles.agentId,
      workspaceId: articles.workspaceId,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = articleRow[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Load agent context and weights
  const [agentCtx, weights] = await Promise.all([
    resolveAgentContext(article.agentId),
    loadAgentWeights(article.agentId),
  ]);

  const keywords = agentCtx.topic ? extractKeywords(agentCtx.topic) : [];

  logger.debug(
    { articleId, keywords: keywords.length, weights },
    "Scoring configuration loaded"
  );

  // Run scoring
  const scoreResult = await scoreArticle(articleId, {
    agentTopic: agentCtx.topic,
    agentTone: agentCtx.tone,
    keywords,
    weights,
    logger,
  });

  // Upsert article_scores record
  const scoredAt = new Date();

  const existingScore = await db
    .select({ id: articleScores.id })
    .from(articleScores)
    .where(eq(articleScores.articleId, articleId))
    .limit(1);

  const scoreData = {
    aiRelevance: scoreResult.aiScores.relevance.toFixed(1),
    keywordMatch: scoreResult.keywordScore.toFixed(1),
    freshness: scoreResult.freshnessScore.toFixed(1),
    sourceTrust: scoreResult.sourceTrustScore.toFixed(1),
    overallScore: scoreResult.overallScore.toFixed(3),
    weightedScore: scoreResult.weightedScore.toFixed(3),
    weightsSnapshot: {
      aiWeights: weights,
      hybrid: { ai: 0.55, keyword: 0.2, freshness: 0.15, sourceTrust: 0.1 },
    } as unknown as Record<string, unknown>,
    chips: scoreResult.chips,
    scoreDetail: {
      aiScore: scoreResult.aiScore,
      keywordScore: scoreResult.keywordScore,
      freshnessScore: scoreResult.freshnessScore,
      sourceTrustScore: scoreResult.sourceTrustScore,
      baseScore: scoreResult.baseScore,
      chipModifierTotal: scoreResult.chipModifierTotal,
      weightedScore: scoreResult.weightedScore,
      triggeredChips: scoreResult.triggeredChips,
    } as Record<string, unknown>,
    scoredAt,
  };

  if (existingScore[0]) {
    await db
      .update(articleScores)
      .set(scoreData)
      .where(eq(articleScores.id, existingScore[0].id));
  } else {
    await db.insert(articleScores).values({
      articleId,
      ...scoreData,
    });
  }

  // Update article score and status
  await db
    .update(articles)
    .set({
      score: scoreResult.weightedScore.toFixed(1),
      status: "scored",
      updatedAt: scoredAt,
    })
    .where(eq(articles.id, articleId));

  logger.info(
    {
      articleId,
      aiScore: scoreResult.aiScore,
      keywordScore: scoreResult.keywordScore,
      freshnessScore: scoreResult.freshnessScore,
      sourceTrustScore: scoreResult.sourceTrustScore,
      baseScore: scoreResult.baseScore,
      chipModifierTotal: scoreResult.chipModifierTotal,
      weightedScore: scoreResult.weightedScore,
      chips: scoreResult.chips,
    },
    "Article scored (hybrid v2)"
  );

  return { ...scoreResult, articleId };
}
