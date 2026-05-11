import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, articleScores, workspaceScoringConfig } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { scoreArticleQueue } from "../../lib/queue.js";

// ─── Default weights (must sum to 1.0) ───

export interface ScoringWeights {
  aiRelevance: number;
  keywordMatch: number;
  freshness: number;
  sourceTrust: number;
}

export interface ChipFilterConfig {
  exclusive?: boolean;
  actionable?: boolean;
  trending?: boolean;
  controversy?: boolean;
  verified?: boolean;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  aiRelevance: 0.35,
  keywordMatch: 0.25,
  freshness: 0.20,
  sourceTrust: 0.20,
};

function validateWeights(weights: Partial<ScoringWeights>): ScoringWeights {
  const full = { ...DEFAULT_WEIGHTS, ...weights };
  const sum = full.aiRelevance + full.keywordMatch + full.freshness + full.sourceTrust;
  const epsilon = 0.05;
  if (Math.abs(sum - 1.0) > epsilon) {
    throw new AppError(400, `Weights must sum to ~1.0, got ${sum.toFixed(3)}`, "INVALID_WEIGHTS");
  }
  return full;
}

// ─── Config persistence (stored in workspace_scoring_config table) ───

export async function getScoringConfig(
  workspaceId: string
): Promise<ScoringWeights & ChipFilterConfig & { workspaceId: string }> {
  const row = await db
    .select()
    .from(workspaceScoringConfig)
    .where(eq(workspaceScoringConfig.workspaceId, workspaceId))
    .limit(1);

  if (row[0]) {
    const r = row[0];
    const chipFilters = (r.chipFilters ?? {}) as ChipFilterConfig;
    return {
      aiRelevance: Number(r.aiRelevance),
      keywordMatch: Number(r.keywordMatch),
      freshness: Number(r.freshness),
      sourceTrust: Number(r.sourceTrust),
      ...chipFilters,
      workspaceId,
    };
  }

  return { ...DEFAULT_WEIGHTS, workspaceId };
}

export async function updateScoringConfig(
  workspaceId: string,
  weights: Partial<ScoringWeights>,
  chipFilters?: ChipFilterConfig
): Promise<ScoringWeights & ChipFilterConfig & { workspaceId: string }> {
  const validated = validateWeights(weights);

  // Upsert: check if row exists
  const existing = await db
    .select({ id: workspaceScoringConfig.id })
    .from(workspaceScoringConfig)
    .where(eq(workspaceScoringConfig.workspaceId, workspaceId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(workspaceScoringConfig)
      .set({
        aiRelevance: validated.aiRelevance.toFixed(4),
        keywordMatch: validated.keywordMatch.toFixed(4),
        freshness: validated.freshness.toFixed(4),
        sourceTrust: validated.sourceTrust.toFixed(4),
        chipFilters: chipFilters ?? {},
        updatedAt: new Date(),
      })
      .where(eq(workspaceScoringConfig.id, existing[0].id));
  } else {
    await db.insert(workspaceScoringConfig).values({
      workspaceId,
      aiRelevance: validated.aiRelevance.toFixed(4),
      keywordMatch: validated.keywordMatch.toFixed(4),
      freshness: validated.freshness.toFixed(4),
      sourceTrust: validated.sourceTrust.toFixed(4),
      chipFilters: chipFilters ?? {},
    });
  }

  return { ...validated, ...(chipFilters ?? {}), workspaceId };
}

// ─── Recalculate scores via BullMQ worker ───

export async function recalculateScores(
  workspaceId: string,
  params: { agentId?: string; articleId?: string }
) {
  const weights = await getScoringConfig(workspaceId);

  // Build article filter
  const conditions = [eq(articles.workspaceId, workspaceId)];
  if (params.agentId) {
    conditions.push(eq(articles.agentId, params.agentId));
  }
  if (params.articleId) {
    conditions.push(eq(articles.id, params.articleId));
  }

  // Score articles that have been fetched/translated/analyzed (not just "analyzed")
  // Include statuses that indicate the article is ready for scoring
  const articlesToScore = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(...conditions))
    .limit(1000);

  let enqueuedCount = 0;
  const errors: string[] = [];

  for (const article of articlesToScore) {
    try {
      await scoreArticleQueue.add(
        "score-article",
        { articleId: article.id },
        {
          jobId: `score:${article.id}:${Date.now()}`,
          attempts: 2,
          backoff: { type: "exponential", delay: 1000 },
        }
      );
      enqueuedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${article.id}: ${msg}`);
    }
  }

  return {
    enqueued: enqueuedCount,
    total: articlesToScore.length,
    errors: errors.length > 0 ? errors : undefined,
    weights,
    triggeredAt: new Date().toISOString(),
  };
}

// ─── Scoring stats ───

export async function getScoringStats(workspaceId: string) {
  // Count articles by score range
  const scoreRanges = [
    { label: "unscored", min: 0, max: 0 },
    { label: "0.0-0.3", min: 0.001, max: 0.3 },
    { label: "0.3-0.6", min: 0.3, max: 0.6 },
    { label: "0.6-0.8", min: 0.6, max: 0.8 },
    { label: "0.8-1.0", min: 0.8, max: 1.0 },
  ];

  const distribution: Record<string, number> = {};

  for (const range of scoreRanges) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(
        and(
          eq(articles.workspaceId, workspaceId),
          range.label === "unscored"
            ? sql`${articles.score} = 0`
            : sql`${articles.score} > ${range.min} AND ${articles.score} <= ${range.max}`
        )
      );
    distribution[range.label] = Number(countResult[0]?.count ?? 0);
  }

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(eq(articles.workspaceId, workspaceId));

  const avgScoreResult = await db
    .select({ avg: sql<number>`COALESCE(AVG(${articles.score}), 0)` })
    .from(articles)
    .where(
      and(eq(articles.workspaceId, workspaceId), sql`${articles.score} > 0`)
    );

  return {
    totalArticles: Number(totalResult[0]?.count ?? 0),
    averageScore: Math.round(Number(avgScoreResult[0]?.avg ?? 0) * 1000) / 1000,
    distribution,
  };
}
