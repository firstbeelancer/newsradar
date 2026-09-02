import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, articles, scoringCriteria } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";

// ─── Scoring Criteria CRUD ───

export async function getAgentScoringCriteria(agentId: string, workspaceId: string) {
  // Verify agent belongs to workspace
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  return db
    .select()
    .from(scoringCriteria)
    .where(eq(scoringCriteria.agentId, agentId))
    .orderBy(scoringCriteria.position);
}

export async function createScoringCriterion(
  agentId: string,
  workspaceId: string,
  data: {
    criterionType: string;
    label: string;
    weight: number;
    threshold?: number;
    isActive?: boolean;
    config?: Record<string, unknown>;
  }
) {
  // Verify agent belongs to workspace
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  // Get next position
  const existing = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${scoringCriteria.position}), -1)` })
    .from(scoringCriteria)
    .where(eq(scoringCriteria.agentId, agentId));

  const nextPos = (existing[0]?.maxPos ?? -1) + 1;

  const [criterion] = await db
    .insert(scoringCriteria)
    .values({
      agentId,
      criterionType: data.criterionType,
      label: data.label,
      weight: data.weight.toFixed(4),
      threshold: data.threshold?.toFixed(4),
      isActive: data.isActive ?? true,
      config: data.config ?? {},
      position: nextPos,
    })
    .returning();

  return criterion;
}

export async function updateScoringCriterion(
  criterionId: string,
  data: {
    label?: string;
    weight?: number;
    threshold?: number;
    isActive?: boolean;
    config?: Record<string, unknown>;
  }
) {
  const existing = await db.query.scoringCriteria.findFirst({
    where: eq(scoringCriteria.id, criterionId),
  });
  if (!existing) {
    throw new AppError(404, "Scoring criterion not found", "CRITERION_NOT_FOUND");
  }

  const [updated] = await db
    .update(scoringCriteria)
    .set({
      ...(data.label !== undefined && { label: data.label }),
      ...(data.weight !== undefined && { weight: data.weight.toFixed(4) }),
      ...(data.threshold !== undefined && { threshold: data.threshold.toFixed(4) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.config !== undefined && { config: data.config }),
      updatedAt: new Date(),
    })
    .where(eq(scoringCriteria.id, criterionId))
    .returning();

  return updated;
}

export async function deleteScoringCriterion(criterionId: string) {
  const existing = await db.query.scoringCriteria.findFirst({
    where: eq(scoringCriteria.id, criterionId),
  });
  if (!existing) {
    throw new AppError(404, "Scoring criterion not found", "CRITERION_NOT_FOUND");
  }

  await db.delete(scoringCriteria).where(eq(scoringCriteria.id, criterionId));
  return { deleted: true };
}

export async function reorderScoringCriteria(agentId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(scoringCriteria)
      .set({ position: i, updatedAt: new Date() })
      .where(
        and(
          eq(scoringCriteria.id, orderedIds[i]),
          eq(scoringCriteria.agentId, agentId)
        )
      );
  }

  return db
    .select()
    .from(scoringCriteria)
    .where(eq(scoringCriteria.agentId, agentId))
    .orderBy(scoringCriteria.position);
}

// ─── Recalculate scores for a specific agent ───

export async function recalculateAgentScores(agentId: string, workspaceId: string) {
  // Get agent's scoring criteria (hybrid formula weights: ai / keyword /
  // freshness / source_trust)
  const criteria = await db
    .select()
    .from(scoringCriteria)
    .where(and(eq(scoringCriteria.agentId, agentId), eq(scoringCriteria.isActive, true)))
    .orderBy(scoringCriteria.position);

  // Build weights map
  const weights: Record<string, number> = {};
  for (const c of criteria) {
    weights[c.criterionType] = Number(c.weight);
  }

  // The worker scores from agents.config, not from this job payload, so report
  // what will actually be applied. Previously this endpoint echoed the
  // scoring_criteria rows (usually empty) and claimed "usedFallbackWeights",
  // which made it look like the agent's weight matrix was being ignored.
  const [agentRow] = await db
    .select({ config: agents.config, name: agents.name, description: agents.description })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)))
    .limit(1);

  const agentConfig = (agentRow?.config as Record<string, unknown> | null) ?? {};
  const aiWeights = (agentConfig.scoringWeights as Record<string, number> | undefined) ?? null;
  const agentTags = Array.isArray(agentConfig.tags)
    ? (agentConfig.tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
    : [];

  // Get articles to score
  const articlesToScore = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.agentId, agentId),
        eq(articles.workspaceId, workspaceId),
        sql`${articles.status} IN ('new', 'translated', 'analyzed', 'scored', 'deduped', 'published')`
      )
    )
    .orderBy(sql`${articles.createdAt} DESC`)
    .limit(1000);

  // Queue scoring jobs instead of doing Math.random()
  let queuedCount = 0;
  try {
    const { getScoreArticleQueue } = await import("../../lib/queues.js");
    const scoreQueue = getScoreArticleQueue();

    for (const article of articlesToScore) {
      await scoreQueue.add("score-article", {
        articleId: article.id,
        agentId,
        workspaceId,
        weights,
        criteriaIds: criteria.map((c) => c.id),
      }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
      });
      queuedCount++;
    }
  } catch (err) {
    console.warn("[scoring] BullMQ queue not available, scoring queued but not processed:", (err as Error).message);
  }

  return {
    agentId,
    criteriaCount: criteria.length,
    // True only when the agent has no configured AI weight matrix at all — that
    // is the case where the worker falls back to DEFAULT_AI_WEIGHTS.
    usedFallbackWeights: aiWeights === null,
    articlesQueued: queuedCount,
    /** Hybrid formula weights from scoring_criteria. */
    weights,
    /** The 5-criteria AI weight matrix the worker will actually apply. */
    aiWeights,
    /** Tags the worker will use as scoring keywords. */
    tags: agentTags,
    triggeredAt: new Date().toISOString(),
  };
}

export async function recalculateWorkspaceScores(workspaceId: string, agentId?: string) {
  const scopedAgents = agentId
    ? await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
    : await db
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.workspaceId, workspaceId));

  if (scopedAgents.length === 0) {
    throw new AppError(404, "Agents not found", "AGENTS_NOT_FOUND");
  }

  const results = [];
  let totalQueued = 0;

  for (const scopedAgent of scopedAgents) {
    const result = await recalculateAgentScores(scopedAgent.id, workspaceId);
    results.push(result);
    totalQueued += result.articlesQueued;
  }

  return {
    agentId: agentId ?? null,
    agentsProcessed: results.length,
    articlesQueued: totalQueued,
    results,
    triggeredAt: new Date().toISOString(),
  };
}

// ─── Scoring stats ───

export async function getScoringStats(workspaceId: string) {
  const scoreRanges = [
    { label: "unscored", query: sql`${articles.score} <= 0` },
    { label: "0-24", query: sql`${articles.score} > 0 AND ${articles.score} < 25` },
    { label: "25-49", query: sql`${articles.score} >= 25 AND ${articles.score} < 50` },
    { label: "50-74", query: sql`${articles.score} >= 50 AND ${articles.score} < 75` },
    { label: "75-100", query: sql`${articles.score} >= 75` },
  ];

  const distribution: Record<string, number> = {};

  for (const range of scoreRanges) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(
        and(
          eq(articles.workspaceId, workspaceId),
          range.query
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
