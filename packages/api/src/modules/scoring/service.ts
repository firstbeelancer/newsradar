import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, articleScores } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";

// ─── Default weights (must sum to 1.0) ───

export interface ScoringWeights {
  aiRelevance: number;
  keywordMatch: number;
  freshness: number;
  sourceTrust: number;
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
  const epsilon = 0.001;
  if (Math.abs(sum - 1.0) > epsilon) {
    throw new AppError(400, `Weights must sum to 1.0, got ${sum.toFixed(3)}`, "INVALID_WEIGHTS");
  }
  return full;
}

// ─── Config persistence (stored in workspace-level JSON for simplicity) ───
// In production this would be a dedicated table. For now we use a simple in-memory
// cache with workspace-specific keys.

const weightCache = new Map<string, ScoringWeights>();

export async function getScoringConfig(workspaceId: string): Promise<ScoringWeights & { workspaceId: string }> {
  const cached = weightCache.get(workspaceId);
  if (cached) {
    return { ...cached, workspaceId };
  }
  return { ...DEFAULT_WEIGHTS, workspaceId };
}

export async function updateScoringConfig(
  workspaceId: string,
  weights: Partial<ScoringWeights>
): Promise<ScoringWeights & { workspaceId: string }> {
  const validated = validateWeights(weights);
  weightCache.set(workspaceId, validated);
  return { ...validated, workspaceId };
}

// ─── Recalculate scores ───

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

  // Only re-score articles that have been analyzed
  conditions.push(eq(articles.status, "analyzed"));

  const articlesToScore = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(...conditions))
    .limit(1000);

  const scoredAt = new Date();
  let updatedCount = 0;

  for (const article of articlesToScore) {
    // In real implementation, each component would be computed by separate logic.
    // Here we simulate the scoring pipeline.
    const aiRelevance = Math.random() * 0.4 + 0.6; // 0.6-1.0
    const keywordMatch = Math.random() * 0.5 + 0.5; // 0.5-1.0
    const freshness = Math.random() * 0.3 + 0.7; // 0.7-1.0
    const sourceTrust = Math.random() * 0.4 + 0.6; // 0.6-1.0

    const overallScore = Math.round(
      (aiRelevance + keywordMatch + freshness + sourceTrust) / 4 * 1000
    ) / 1000;

    const weightedScore = Math.round(
      (aiRelevance * weights.aiRelevance +
        keywordMatch * weights.keywordMatch +
        freshness * weights.freshness +
        sourceTrust * weights.sourceTrust) *
        1000
    ) / 1000;

    // Upsert score record
    const existingScore = await db.query.articleScores.findFirst({
      where: eq(articleScores.articleId, article.id),
    });

    if (existingScore) {
      await db
        .update(articleScores)
        .set({
          aiRelevance: aiRelevance.toFixed(2),
          keywordMatch: keywordMatch.toFixed(2),
          freshness: freshness.toFixed(2),
          sourceTrust: sourceTrust.toFixed(2),
          overallScore: overallScore.toFixed(3),
          weightedScore: weightedScore.toFixed(3),
          weightsSnapshot: weights as Record<string, unknown>,
          scoredAt,
        })
        .where(eq(articleScores.id, existingScore.id));
    } else {
      await db.insert(articleScores).values({
        articleId: article.id,
        aiRelevance: aiRelevance.toFixed(2),
        keywordMatch: keywordMatch.toFixed(2),
        freshness: freshness.toFixed(2),
        sourceTrust: sourceTrust.toFixed(2),
        overallScore: overallScore.toFixed(3),
        weightedScore: weightedScore.toFixed(3),
        weightsSnapshot: weights as Record<string, unknown>,
        scoredAt,
      });
    }

    // Update article score field
    await db
      .update(articles)
      .set({
        score: weightedScore.toFixed(3),
        status: "scored",
        updatedAt: scoredAt,
      })
      .where(eq(articles.id, article.id));

    updatedCount++;
  }

  return {
    recalculated: updatedCount,
    weights,
    triggeredAt: scoredAt.toISOString(),
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
