/**
 * ------------------------------------------------------------------
 * Worker: score-article
 * ------------------------------------------------------------------
 * Runs 4 scoring criteria (ai_relevance, keyword_match, freshness,
 * source_trust), computes weighted score, writes article_scores,
 * updates article.score and status='scored', determines chips.
 *
 * Reads workspace-specific weights from workspace_scoring_config table.
 * Falls back to agent.config.scoring_weights, then DEFAULT_WEIGHTS.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import {
  articles,
  articleScores,
  agents,
  sources,
  workspaceScoringConfig,
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
 * Load workspace-specific scoring weights from DB.
 * Falls back to DEFAULT_WEIGHTS if no custom config exists.
 */
async function getWorkspaceWeights(workspaceId: string): Promise<ScoringWeights> {
  try {
    const row = await db
      .select()
      .from(workspaceScoringConfig)
      .where(eq(workspaceScoringConfig.workspaceId, workspaceId))
      .limit(1);

    if (row[0]) {
      return {
        aiRelevance: Number(row[0].aiRelevance),
        keywordMatch: Number(row[0].keywordMatch),
        freshness: Number(row[0].freshness),
        sourceTrust: Number(row[0].sourceTrust),
      };
    }
  } catch {
    // Table may not exist yet during migration — fall back to defaults
  }
  return DEFAULT_WEIGHTS;
}

/**
 * Load agent-level scoring weights from agent.config JSONB.
 * Takes precedence over workspace-level if present.
 */
function getAgentWeights(agentConfig: Record<string, unknown> | null): ScoringWeights | null {
  if (!agentConfig?.scoring_weights) return null;
  const sw = agentConfig.scoring_weights as Record<string, unknown>;
  if (typeof sw.aiRelevance === "number" || typeof sw.ai_relevance === "number") {
    return {
      aiRelevance: (sw.aiRelevance ?? sw.ai_relevance ?? 0.35) as number,
      keywordMatch: (sw.keywordMatch ?? sw.keyword_match ?? 0.25) as number,
      freshness: (sw.freshness ?? 0.20) as number,
      sourceTrust: (sw.sourceTrust ?? sw.source_trust ?? 0.20) as number,
    };
  }
  return null;
}

/**
 * Resolve agent topic and config for keyword matching.
 */
async function resolveAgentInfo(agentId: string): Promise<{
  topic: string | undefined;
  config: Record<string, unknown> | null;
}> {
  const result = await db
    .select({
      name: agents.name,
      description: agents.description,
      subjectArea: agents.subjectArea,
      config: agents.config,
    })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const agent = result[0];
  if (!agent) return { topic: undefined, config: null };

  // Build topic from name + description + subjectArea
  const parts = [agent.name, agent.description ?? "", agent.subjectArea ?? ""].filter(Boolean);
  return {
    topic: parts.join(" ").trim(),
    config: (agent.config as Record<string, unknown>) ?? null,
  };
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

  // Load scoring configuration — 3-level resolution:
  // 1. Agent-level weights (from agent.config.scoring_weights) — most specific
  // 2. Workspace-level weights (from workspace_scoring_config table)
  // 3. DEFAULT_WEIGHTS — fallback
  const [workspaceWeights, agentInfo] = await Promise.all([
    getWorkspaceWeights(article.workspaceId),
    resolveAgentInfo(article.agentId),
  ]);

  const agentWeights = agentInfo.config ? getAgentWeights(agentInfo.config) : null;
  const weights = agentWeights ?? workspaceWeights;

  const keywords = agentInfo.topic ? extractKeywords(agentInfo.topic) : [];

  logger.debug(
    { articleId, keywords: keywords.length, weights, source: agentWeights ? "agent" : "workspace" },
    "Scoring configuration loaded"
  );

  // Run scoring
  const scoreResult = await scoreArticle(articleId, {
    agentTopic: agentInfo.topic,
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
