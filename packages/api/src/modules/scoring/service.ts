import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, articleScores, workspaceScoringConfig } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { scoreArticleQueue } from "../../lib/queue.js";

// ─── Types ───

export interface AIScoringWeights {
  relevance: number; // 0-100
  novelty: number;   // 0-100
  hype: number;      // 0-100
  practical: number; // 0-100
  local: number;     // 0-100
}

export interface MetaWeights {
  aiWeight: number;        // default 0.55
  keywordWeight: number;   // default 0.20
  freshnessWeight: number; // default 0.15
  sourceTrustWeight: number; // default 0.10
}

export interface ScoringWeights {
  aiRelevance: number;
  keywordMatch: number;
  freshness: number;
  sourceTrust: number;
}

export interface ChipFilterConfig {
  [key: string]: boolean | undefined;
}

export const DEFAULT_AI_WEIGHTS: AIScoringWeights = {
  relevance: 30,
  novelty: 25,
  hype: 15,
  practical: 20,
  local: 10,
};

export const DEFAULT_META_WEIGHTS: MetaWeights = {
  aiWeight: 0.55,
  keywordWeight: 0.20,
  freshnessWeight: 0.15,
  sourceTrustWeight: 0.10,
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
  aiRelevance: 0.35,
  keywordMatch: 0.25,
  freshness: 0.20,
  sourceTrust: 0.20,
};

function validateMetaWeights(weights: Partial<MetaWeights>): MetaWeights {
  const full = { ...DEFAULT_META_WEIGHTS, ...weights };
  const sum = full.aiWeight + full.keywordWeight + full.freshnessWeight + full.sourceTrustWeight;
  const epsilon = 0.05;
  if (Math.abs(sum - 1.0) > epsilon) {
    throw new AppError(400, `Meta weights must sum to ~1.0, got ${sum.toFixed(3)}`, "INVALID_WEIGHTS");
  }
  return full;
}

function validateAIWeights(weights: Partial<AIScoringWeights>): AIScoringWeights {
  const full = { ...DEFAULT_AI_WEIGHTS, ...weights };
  const sum = full.relevance + full.novelty + full.hype + full.practical + full.local;
  if (sum <= 0) {
    throw new AppError(400, "AI weights must have positive values", "INVALID_WEIGHTS");
  }
  return full;
}

// ─── Config persistence (stored in workspace_scoring_config table) ───

export interface FullScoringConfig extends ScoringWeights, MetaWeights, ChipFilterConfig {
  workspaceId: string;
  scoring_weights: AIScoringWeights;
}

export async function getScoringConfig(
  workspaceId: string
): Promise<FullScoringConfig> {
  const row = await db
    .select()
    .from(workspaceScoringConfig)
    .where(eq(workspaceScoringConfig.workspaceId, workspaceId))
    .limit(1);

  if (row[0]) {
    const r = row[0];
    const chipFilters = (r.chipFilters ?? {}) as ChipFilterConfig;
    const sw = r.scoringWeights as Record<string, unknown> | null;

    const scoringWeights: AIScoringWeights = sw && typeof sw === "object"
      ? {
          relevance: (sw.relevance as number) ?? DEFAULT_AI_WEIGHTS.relevance,
          novelty: (sw.novelty as number) ?? DEFAULT_AI_WEIGHTS.novelty,
          hype: (sw.hype as number) ?? DEFAULT_AI_WEIGHTS.hype,
          practical: (sw.practical as number) ?? DEFAULT_AI_WEIGHTS.practical,
          local: (sw.local as number) ?? DEFAULT_AI_WEIGHTS.local,
        }
      : DEFAULT_AI_WEIGHTS;

    return {
      // Legacy 4-criteria weights
      aiRelevance: Number(r.aiRelevance),
      keywordMatch: Number(r.keywordMatch),
      freshness: Number(r.freshness),
      sourceTrust: Number(r.sourceTrust),
      // Meta weights for hybrid formula
      aiWeight: Number(r.aiWeight) || DEFAULT_META_WEIGHTS.aiWeight,
      keywordWeight: Number(r.keywordWeight) || DEFAULT_META_WEIGHTS.keywordWeight,
      freshnessWeight: Number(r.freshnessWeight) || DEFAULT_META_WEIGHTS.freshnessWeight,
      sourceTrustWeight: Number(r.sourceTrustWeight) || DEFAULT_META_WEIGHTS.sourceTrustWeight,
      // AI sub-criteria weights
      scoring_weights: scoringWeights,
      // Chip filter toggles
      ...chipFilters,
      workspaceId,
    };
  }

  return {
    ...DEFAULT_WEIGHTS,
    ...DEFAULT_META_WEIGHTS,
    scoring_weights: DEFAULT_AI_WEIGHTS,
    workspaceId,
  };
}

export async function updateScoringConfig(
  workspaceId: string,
  data: {
    metaWeights?: Partial<MetaWeights>;
    aiWeights?: Partial<AIScoringWeights>;
    chipFilters?: ChipFilterConfig;
  }
): Promise<FullScoringConfig> {
  const validatedMeta = data.metaWeights ? validateMetaWeights(data.metaWeights) : undefined;
  const validatedAI = data.aiWeights ? validateAIWeights(data.aiWeights) : undefined;

  // Upsert: check if row exists
  const existing = await db
    .select({ id: workspaceScoringConfig.id })
    .from(workspaceScoringConfig)
    .where(eq(workspaceScoringConfig.workspaceId, workspaceId))
    .limit(1);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validatedMeta) {
    updateData.aiWeight = validatedMeta.aiWeight.toFixed(4);
    updateData.keywordWeight = validatedMeta.keywordWeight.toFixed(4);
    updateData.freshnessWeight = validatedMeta.freshnessWeight.toFixed(4);
    updateData.sourceTrustWeight = validatedMeta.sourceTrustWeight.toFixed(4);
  }

  if (validatedAI) {
    updateData.scoringWeights = JSON.stringify(validatedAI);
  }

  if (data.chipFilters) {
    updateData.chipFilters = JSON.stringify(data.chipFilters);
  }

  if (existing[0]) {
    await db
      .update(workspaceScoringConfig)
      .set(updateData)
      .where(eq(workspaceScoringConfig.id, existing[0].id));
  } else {
    await db.insert(workspaceScoringConfig).values({
      workspaceId,
      ...(validatedMeta ? {
        aiWeight: validatedMeta.aiWeight.toFixed(4),
        keywordWeight: validatedMeta.keywordWeight.toFixed(4),
        freshnessWeight: validatedMeta.freshnessWeight.toFixed(4),
        sourceTrustWeight: validatedMeta.sourceTrustWeight.toFixed(4),
      } : {}),
      ...(validatedAI ? {
        scoringWeights: JSON.stringify(validatedAI),
      } : {
        scoringWeights: JSON.stringify(DEFAULT_AI_WEIGHTS),
      }),
      ...(data.chipFilters ? {
        chipFilters: JSON.stringify(data.chipFilters),
      } : {}),
    });
  }

  return getScoringConfig(workspaceId);
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

  // Score articles that have been fetched/translated/analyzed
  const articlesToScore = await db
    .select({ id: articles.id, status: articles.status })
    .from(articles)
    .where(
      and(
        ...conditions,
        sql`${articles.status} NOT IN ('deduped', 'archived')`
      )
    )
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
