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
  type ScoreResult,
} from "../lib/scorer.js";
import { buildAgentScoringContext } from "./agent-scoring-context.js";
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
  keywords: string[];
}> {
  const result = await db
    .select({ name: agents.name, description: agents.description, config: agents.config })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const agent = result[0];
  if (!agent) return { keywords: [] };

  return buildAgentScoringContext({
    name: agent.name,
    description: agent.description,
    config: agent.config as Record<string, unknown> | null,
  });
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

  const keywords = agentCtx.keywords;

  logger.debug(
    { articleId, keywords: keywords.length, weights },
    "Scoring configuration loaded"
  );

  // Run scoring
  const scoreResult = await scoreArticle(articleId, {
    workspaceId: article.workspaceId,
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
      keywords,
    } as unknown as Record<string, unknown>,
    chips: scoreResult.chips,
    scoredAt,
  };

  const articleScoreDetail = {
    aiScore: scoreResult.aiScore,
    keywordScore: scoreResult.keywordScore,
    keywordMatches: scoreResult.keywordMatches,
    keywordTotal: scoreResult.keywordTotal,
    matchedKeywords: scoreResult.matchedKeywords,
    freshnessScore: scoreResult.freshnessScore,
    sourceTrustScore: scoreResult.sourceTrustScore,
    baseScore: scoreResult.baseScore,
    chipModifierTotal: scoreResult.chipModifierTotal,
    weightedScore: scoreResult.weightedScore,
    aiFallbackUsed: scoreResult.aiFallbackUsed,
    aiFallbackReason: scoreResult.aiFallbackReason,
    relevanceCap: scoreResult.relevanceCap,
    triggeredChips: scoreResult.triggeredChips,
  } as Record<string, unknown>;

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
      scoreDetail: articleScoreDetail,
      status: "scored",
      updatedAt: scoredAt,
    })
    .where(eq(articles.id, articleId));

  logger.info(
    {
      articleId,
      aiScore: scoreResult.aiScore,
      keywordScore: scoreResult.keywordScore,
      keywordMatches: scoreResult.keywordMatches,
      keywordTotal: scoreResult.keywordTotal,
      freshnessScore: scoreResult.freshnessScore,
      sourceTrustScore: scoreResult.sourceTrustScore,
      baseScore: scoreResult.baseScore,
      chipModifierTotal: scoreResult.chipModifierTotal,
      weightedScore: scoreResult.weightedScore,
      aiFallbackUsed: scoreResult.aiFallbackUsed,
      aiFallbackReason: scoreResult.aiFallbackReason,
      relevanceCap: scoreResult.relevanceCap,
      chips: scoreResult.chips,
    },
    "Article scored (hybrid v2)"
  );

  return { ...scoreResult, articleId };
}
