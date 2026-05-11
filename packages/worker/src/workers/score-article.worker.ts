/**
 * ------------------------------------------------------------------
 * Worker: score-article
 * ------------------------------------------------------------------
 * Runs the hybrid 5+4 scoring model:
 *   - 5 AI sub-criteria (relevance, novelty, hype, practical, local)
 *   - 4 meta criteria (ai_score, keyword_match, freshness, source_trust)
 *   - Chip filters with score modifiers
 *
 * Reads agent-specific weights from agent.config.scoring_weights,
 * falls back to workspace_scoring_config, then DEFAULT weights.
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
  DEFAULT_AI_WEIGHTS,
  DEFAULT_META_WEIGHTS,
  DEFAULT_WEIGHTS,
  extractKeywords,
  type ScoringWeights,
  type ScoreResult,
  type AIScoringWeights,
  type MetaWeights,
} from "../lib/scorer.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface ScoreArticleJob {
  articleId: string;
}

/** Default AI sub-criteria weights for a workspace */
const DEFAULT_WORKSPACE_AI_WEIGHTS: AIScoringWeights = {
  relevance: 30,
  novelty: 25,
  hype: 15,
  practical: 20,
  local: 10,
};

/**
 * Load workspace-specific scoring config from DB.
 * Returns both meta weights and AI sub-criteria weights.
 */
async function getWorkspaceScoringConfig(workspaceId: string): Promise<{
  metaWeights: MetaWeights;
  aiWeights: AIScoringWeights;
}> {
  try {
    const row = await db
      .select()
      .from(workspaceScoringConfig)
      .where(eq(workspaceScoringConfig.workspaceId, workspaceId))
      .limit(1);

    if (row[0]) {
      const r = row[0];
      const metaWeights: MetaWeights = {
        aiWeight: Number(r.aiWeight) || DEFAULT_META_WEIGHTS.aiWeight,
        keywordWeight: Number(r.keywordWeight) || DEFAULT_META_WEIGHTS.keywordWeight,
        freshnessWeight: Number(r.freshnessWeight) || DEFAULT_META_WEIGHTS.freshnessWeight,
        sourceTrustWeight: Number(r.sourceTrustWeight) || DEFAULT_META_WEIGHTS.sourceTrustWeight,
      };

      // Parse AI sub-criteria weights from scoringWeights JSONB
      const sw = r.scoringWeights as Record<string, unknown> | null;
      const aiWeights: AIScoringWeights = sw && typeof sw === "object"
        ? {
            relevance: (sw.relevance as number) ?? DEFAULT_WORKSPACE_AI_WEIGHTS.relevance,
            novelty: (sw.novelty as number) ?? DEFAULT_WORKSPACE_AI_WEIGHTS.novelty,
            hype: (sw.hype as number) ?? DEFAULT_WORKSPACE_AI_WEIGHTS.hype,
            practical: (sw.practical as number) ?? DEFAULT_WORKSPACE_AI_WEIGHTS.practical,
            local: (sw.local as number) ?? DEFAULT_WORKSPACE_AI_WEIGHTS.local,
          }
        : DEFAULT_WORKSPACE_AI_WEIGHTS;

      return { metaWeights, aiWeights };
    }
  } catch {
    // Table may not exist yet during migration — fall back to defaults
  }
  return { metaWeights: DEFAULT_META_WEIGHTS, aiWeights: DEFAULT_WORKSPACE_AI_WEIGHTS };
}

/**
 * Load agent-level scoring weights from agent.config JSONB.
 * Takes precedence over workspace-level if present.
 */
function getAgentScoringConfig(agentConfig: Record<string, unknown> | null): {
  aiWeights: AIScoringWeights | null;
  metaWeights: MetaWeights | null;
} {
  if (!agentConfig) return { aiWeights: null, metaWeights: null };

  const result: { aiWeights: AIScoringWeights | null; metaWeights: MetaWeights | null } = {
    aiWeights: null,
    metaWeights: null,
  };

  // Parse AI sub-criteria weights from agent.config.scoring_weights
  if (agentConfig.scoring_weights && typeof agentConfig.scoring_weights === "object") {
    const sw = agentConfig.scoring_weights as Record<string, unknown>;
    if (typeof sw.relevance === "number" || typeof sw.novelty === "number") {
      result.aiWeights = {
        relevance: (sw.relevance as number) ?? DEFAULT_AI_WEIGHTS.relevance,
        novelty: (sw.novelty as number) ?? DEFAULT_AI_WEIGHTS.novelty,
        hype: (sw.hype as number) ?? DEFAULT_AI_WEIGHTS.hype,
        practical: (sw.practical as number) ?? DEFAULT_AI_WEIGHTS.practical,
        local: (sw.local as number) ?? DEFAULT_AI_WEIGHTS.local,
      };
    }
  }

  // Parse meta weights from agent.config.meta_weights
  if (agentConfig.meta_weights && typeof agentConfig.meta_weights === "object") {
    const mw = agentConfig.meta_weights as Record<string, unknown>;
    result.metaWeights = {
      aiWeight: (mw.aiWeight ?? mw.ai_weight ?? DEFAULT_META_WEIGHTS.aiWeight) as number,
      keywordWeight: (mw.keywordWeight ?? mw.keyword_weight ?? DEFAULT_META_WEIGHTS.keywordWeight) as number,
      freshnessWeight: (mw.freshnessWeight ?? mw.freshness_weight ?? DEFAULT_META_WEIGHTS.freshnessWeight) as number,
      sourceTrustWeight: (mw.sourceTrustWeight ?? mw.source_trust_weight ?? DEFAULT_META_WEIGHTS.sourceTrustWeight) as number,
    };
  }

  return result;
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

  logger.debug({ articleId, jobId: job.id }, "Processing article scoring (hybrid 5+4 model)");

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
  // 1. Agent-level weights (from agent.config) — most specific
  // 2. Workspace-level weights (from workspace_scoring_config table)
  // 3. DEFAULT_WEIGHTS — fallback
  const [workspaceConfig, agentInfo] = await Promise.all([
    getWorkspaceScoringConfig(article.workspaceId),
    resolveAgentInfo(article.agentId),
  ]);

  const agentConfig = getAgentScoringConfig(agentInfo.config);
  const aiWeights = agentConfig.aiWeights ?? workspaceConfig.aiWeights;
  const metaWeights = agentConfig.metaWeights ?? workspaceConfig.metaWeights;

  const keywords = agentInfo.topic ? extractKeywords(agentInfo.topic) : [];

  logger.debug(
    {
      articleId,
      keywords: keywords.length,
      aiWeights,
      metaWeights,
      source: agentConfig.aiWeights ? "agent" : "workspace",
    },
    "Scoring configuration loaded (hybrid 5+4)"
  );

  // Run scoring with the hybrid model
  const scoreResult = await scoreArticle(articleId, {
    agentTopic: agentInfo.topic,
    keywords,
    aiWeights,
    metaWeights,
    agentId: article.agentId,
  });

  // Upsert article_scores record
  const scoredAt = new Date();

  const existingScore = await db
    .select({ id: articleScores.id })
    .from(articleScores)
    .where(eq(articleScores.articleId, articleId))
    .limit(1);

  // The weights snapshot stores both AI and meta weights for traceability
  const weightsSnapshot = {
    aiWeights,
    metaWeights,
  };

  if (existingScore[0]) {
    await db
      .update(articleScores)
      .set({
        aiRelevance: scoreResult.aiRelevance.toFixed(2),
        keywordMatch: scoreResult.keywordMatch.toFixed(2),
        freshness: scoreResult.freshness.toFixed(2),
        sourceTrust: scoreResult.sourceTrust.toFixed(2),
        // New AI sub-criteria
        relevance: scoreResult.relevance.toFixed(2),
        novelty: scoreResult.novelty.toFixed(2),
        hype: scoreResult.hype.toFixed(2),
        practical: scoreResult.practical.toFixed(2),
        local: scoreResult.local.toFixed(2),
        overallScore: scoreResult.overallScore.toFixed(3),
        weightedScore: scoreResult.weightedScore.toFixed(3),
        weightsSnapshot: weightsSnapshot as unknown as Record<string, unknown>,
        chips: scoreResult.chips,
        scoreDetail: {
          aiScore: scoreResult.aiScore,
        },
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
      // New AI sub-criteria
      relevance: scoreResult.relevance.toFixed(2),
      novelty: scoreResult.novelty.toFixed(2),
      hype: scoreResult.hype.toFixed(2),
      practical: scoreResult.practical.toFixed(2),
      local: scoreResult.local.toFixed(2),
      overallScore: scoreResult.overallScore.toFixed(3),
      weightedScore: scoreResult.weightedScore.toFixed(3),
      weightsSnapshot: weightsSnapshot as unknown as Record<string, unknown>,
      chips: scoreResult.chips,
      scoreDetail: {
        aiScore: scoreResult.aiScore,
      },
      scoredAt,
    });
  }

  // Update article score and status
  // Scale weightedScore to 0-1 range for the articles.score column (which is decimal 5,3)
  const articleScore = (scoreResult.weightedScore / 100).toFixed(3);
  await db
    .update(articles)
    .set({
      score: articleScore,
      status: "scored",
      updatedAt: scoredAt,
    })
    .where(eq(articles.id, articleId));

  logger.info(
    {
      articleId,
      aiScore: scoreResult.aiScore,
      weightedScore: scoreResult.weightedScore,
      overallScore: scoreResult.overallScore,
      chips: scoreResult.chips,
      aiSubCriteria: {
        relevance: scoreResult.relevance,
        novelty: scoreResult.novelty,
        hype: scoreResult.hype,
        practical: scoreResult.practical,
        local: scoreResult.local,
      },
    },
    "Article scored successfully (hybrid 5+4 model)"
  );

  return { ...scoreResult, articleId };
}
