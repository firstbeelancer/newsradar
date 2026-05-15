import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, sources, agentSources, articles, operationLogs, scoringCriteria, chipFilters, subjectAreas } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { Agent, NewAgent } from "../../db/types.js";

// ─── Default scoring weights ───
// 5 AI criteria weights (percentages, must sum to ~100)
// Plus 4 hybrid formula weights (decimals 0–1, fixed)

export const DEFAULT_SCORING_WEIGHTS = {
  relevance: 30,
  novelty: 25,
  hype: 20,
  practical: 15,
  local: 10,
};

/** Hybrid blend weights (fixed formula) */
export const HYBRID_FORMULA_WEIGHTS = {
  ai: 0.55,
  keyword: 0.20,
  freshness: 0.15,
  sourceTrust: 0.10,
};

// ─── Default config for a new agent ───

export const DEFAULT_AGENT_CONFIG = {
  targetAudience: "",
  tone: "профессиональный",
  systemPrompt: "",
  userPrompt: "",
  tags: [] as string[],
  scoringWeights: DEFAULT_SCORING_WEIGHTS,
  chipFilters: [] as unknown[],
  fetchSchedule: "",
};

// ─── CRUD ───

export async function createAgent(data: NewAgent) {
  // If subjectArea is set, populate defaults from subject_areas
  let config = (data.config as Record<string, unknown>) ?? {};
  
  if (data.subjectArea) {
    const area = await db.query.subjectAreas.findFirst({
      where: eq(subjectAreas.id, data.subjectArea),
    });
    if (area) {
      const defaults = area.defaultsJson as Record<string, unknown> ?? {};
      config = {
        ...DEFAULT_AGENT_CONFIG,
        ...defaults,
        ...(data.config as Record<string, unknown> ?? {}), // user overrides take precedence
      };
    }
  } else {
    config = {
      ...DEFAULT_AGENT_CONFIG,
      ...config,
    };
  }

  const [agent] = await db.insert(agents).values({
    ...data,
    config,
  }).returning();

  // Create default scoring criteria for this agent (hybrid formula weights)
  if (agent) {
    const criteriaRows = [
      { criterionType: "ai_relevance", label: "AI-релевантность (55%)", weight: "0.5500", position: 0 },
      { criterionType: "keyword_match", label: "Совпадение ключевых слов (20%)", weight: "0.2000", position: 1 },
      { criterionType: "freshness", label: "Свежесть (15%)", weight: "0.1500", position: 2 },
      { criterionType: "source_trust", label: "Доверие к источнику (10%)", weight: "0.1000", position: 3 },
    ];

    for (const c of criteriaRows) {
      await db.insert(scoringCriteria).values({
        agentId: agent.id,
        criterionType: c.criterionType,
        label: c.label,
        weight: c.weight,
        position: c.position,
        isActive: true,
        config: {},
      });
    }

    // Create chip filters from config if provided
    const configChipFilters = (config as Record<string, unknown>)?.chipFilters;
    if (Array.isArray(configChipFilters)) {
      for (let i = 0; i < configChipFilters.length; i++) {
        const cf = configChipFilters[i] as Record<string, unknown>;
        await db.insert(chipFilters).values({
          agentId: agent.id,
          key: (cf.key as string) || `filter_${i}`,
          label: (cf.label as string) || `Filter ${i}`,
          description: (cf.description as string) || null,
          pattern: (cf.pattern as string) || null,
          operator: (cf.operator as string) || "contains",
          scoreModifier: (cf.scoreModifier as number ?? 0).toString(),
          color: (cf.color as string) || "default",
          icon: (cf.icon as string) || null,
          isActive: (cf.isActive as boolean) ?? true,
          position: i,
        });
      }
    }
  }

  return getAgentById(agent.id, agent.workspaceId);
}

export async function getAgentById(id: string, workspaceId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  // Enrich with scoring criteria and chip filters
  const criteria = await db
    .select()
    .from(scoringCriteria)
    .where(eq(scoringCriteria.agentId, id))
    .orderBy(scoringCriteria.position);

  const chips = await db
    .select()
    .from(chipFilters)
    .where(eq(chipFilters.agentId, id))
    .orderBy(chipFilters.position);

  return {
    ...agent,
    scoringCriteria: criteria,
    chipFilters: chips,
  };
}

export async function listAgents(
  workspaceId: string,
  params: { limit: number; cursor?: string | null }
): Promise<PaginatedResult<Agent & { articleCount: number; sourceCount: number }>> {
  const conditions = [eq(agents.workspaceId, workspaceId)];

  // Get agents with article and source counts via subqueries
  const agentRows = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      icon: agents.icon,
      color: agents.color,
      workspaceId: agents.workspaceId,
      subjectArea: agents.subjectArea,
      config: agents.config,
      position: agents.position,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      articleCount: sql<number>`COALESCE((SELECT COUNT(*) FROM articles WHERE articles.agent_id = agents.id AND articles.workspace_id = ${workspaceId}), 0)`,
      sourceCount: sql<number>`COALESCE((SELECT COUNT(*) FROM agent_sources WHERE agent_sources.agent_id = agents.id), 0)`,
    })
    .from(agents)
    .where(and(...conditions))
    .orderBy(agents.position, desc(agents.createdAt))
    .limit(params.limit + 1);

  let rows = agentRows;

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      const cursorRows = await db
        .select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          icon: agents.icon,
          color: agents.color,
          workspaceId: agents.workspaceId,
          subjectArea: agents.subjectArea,
          config: agents.config,
          position: agents.position,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
          articleCount: sql<number>`COALESCE((SELECT COUNT(*) FROM articles WHERE articles.agent_id = agents.id AND articles.workspace_id = ${workspaceId}), 0)`,
          sourceCount: sql<number>`COALESCE((SELECT COUNT(*) FROM agent_sources WHERE agent_sources.agent_id = agents.id), 0)`,
        })
        .from(agents)
        .where(
          and(
            ...conditions,
            sql`${agents.createdAt} < ${new Date(decoded.sortValue)}`
          )
        )
        .orderBy(agents.position, desc(agents.createdAt))
        .limit(params.limit + 1);
      rows = cursorRows;
    }
  }

  const hasMore = rows.length > params.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;

  const lastItem = data[data.length - 1];
  const nextCursor: string | null =
    hasMore && lastItem
      ? encodeCursor({
          id: lastItem.id,
          sortValue: lastItem.createdAt.toISOString(),
        } as Cursor)
      : null;

  return { data, nextCursor, hasMore };
}

export async function updateAgent(
  id: string,
  workspaceId: string,
  data: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    position?: number;
    subjectArea?: string;
    config?: Record<string, unknown>;
  }
) {
  const existing = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)),
  });
  if (!existing) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  // Merge config
  const existingConfig = (existing.config as Record<string, unknown>) ?? {};
  const newConfig = data.config ? { ...existingConfig, ...data.config } : existingConfig;

  // If scoring weights changed in config, update hybrid formula in scoringCriteria
  // The 5 AI sub-weights (relevance, novelty, hype, practical, local) stay in config.
  // The 4 hybrid formula weights (ai, keyword, freshness, sourceTrust) stay in scoring_criteria.
  if (data.config?.scoringWeights) {
    const weights = data.config.scoringWeights as Record<string, number>;
    // Sync hybrid formula weights if provided (legacy keys, decimals 0–1)
    const hybridMapping: Record<string, string> = {
      aiRelevance: "ai_relevance",
      keywordMatch: "keyword_match",
      freshness: "freshness",
      sourceTrust: "source_trust",
    };
    for (const [key, criterionType] of Object.entries(hybridMapping)) {
      if (weights[key] !== undefined) {
        await db
          .update(scoringCriteria)
          .set({ weight: weights[key].toFixed(4), updatedAt: new Date() })
          .where(
            and(
              eq(scoringCriteria.agentId, id),
              eq(scoringCriteria.criterionType, criterionType)
            )
          );
      }
    }
  }

  // If chip filters changed in config, replace them
  if (data.config?.chipFilters && Array.isArray(data.config.chipFilters)) {
    // Delete existing
    await db.delete(chipFilters).where(eq(chipFilters.agentId, id));
    // Insert new
    for (let i = 0; i < (data.config.chipFilters as Record<string, unknown>[]).length; i++) {
      const cf = (data.config.chipFilters as Record<string, unknown>[])[i];
      await db.insert(chipFilters).values({
        agentId: id,
        key: (cf.key as string) || `filter_${i}`,
        label: (cf.label as string) || `Filter ${i}`,
        description: (cf.description as string) || null,
        pattern: (cf.pattern as string) || null,
        operator: (cf.operator as string) || "contains",
        scoreModifier: (cf.scoreModifier as number ?? 0).toString(),
        color: (cf.color as string) || "default",
        icon: (cf.icon as string) || null,
        isActive: (cf.isActive as boolean) ?? true,
        position: i,
      });
    }
    // Remove chipFilters from config to avoid duplication
    delete newConfig.chipFilters;
  }

  // If tags changed, just update config (tags stored in config JSONB)
  // Tags are managed through config.tags

  const [updated] = await db
    .update(agents)
    .set({
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      position: data.position,
      subjectArea: data.subjectArea,
      config: newConfig,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)))
    .returning();

  return getAgentById(updated.id, workspaceId);
}

export async function deleteAgent(id: string, workspaceId: string) {
  const existing = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)),
  });
  if (!existing) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }
  await db.delete(agents).where(and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)));
  return { deleted: true };
}

// ─── Stats ───

export async function getAgentStats(id: string, workspaceId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  const sourceCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentSources)
    .where(eq(agentSources.agentId, id));

  const articleCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(and(eq(articles.agentId, id), eq(articles.workspaceId, workspaceId)));

  const statusCounts = await db
    .select({
      status: articles.status,
      count: sql<number>`count(*)`,
    })
    .from(articles)
    .where(and(eq(articles.agentId, id), eq(articles.workspaceId, workspaceId)))
    .groupBy(articles.status);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(
      and(
        eq(articles.agentId, id),
        eq(articles.workspaceId, workspaceId),
        sql`${articles.createdAt} >= ${today}`
      )
    );

  return {
    sourceCount: Number(sourceCountResult[0]?.count ?? 0),
    articleCount: Number(articleCountResult[0]?.count ?? 0),
    todayCount: Number(todayCountResult[0]?.count ?? 0),
    statusBreakdown: statusCounts.reduce(
      (acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}

// ─── Source linking ───

export async function linkSource(agentId: string, sourceId: string, workspaceId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  const source = await db.query.sources.findFirst({
    where: and(eq(sources.id, sourceId), eq(sources.workspaceId, workspaceId)),
  });
  if (!source) {
    throw new AppError(404, "Source not found", "SOURCE_NOT_FOUND");
  }

  const [link] = await db
    .insert(agentSources)
    .values({ agentId, sourceId })
    .onConflictDoNothing({ target: [agentSources.agentId, agentSources.sourceId] })
    .returning();

  return link ?? { agentId, sourceId, alreadyLinked: true };
}

export async function unlinkSource(agentId: string, sourceId: string, workspaceId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  await db
    .delete(agentSources)
    .where(
      and(
        eq(agentSources.agentId, agentId),
        eq(agentSources.sourceId, sourceId)
      )
    );

  return { unlinked: true };
}

export async function getAgentSources(agentId: string, workspaceId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  const rows = await db
    .select({
      source: sources,
    })
    .from(agentSources)
    .innerJoin(sources, eq(agentSources.sourceId, sources.id))
    .where(eq(agentSources.agentId, agentId));

  return rows.map((r) => r.source);
}

// ─── Collect trigger ───

export async function triggerCollection(agentId: string, workspaceId: string, userId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }

  const linkedSources = await getAgentSources(agentId, workspaceId);
  const activeSources = linkedSources.filter((source) => source.isActive);

  const [log] = await db
    .insert(operationLogs)
    .values({
      userId,
      workspaceId,
      agentId,
      operationType: "collect_agent",
      entityType: "agent",
      entityId: agentId,
      status: activeSources.length > 0 ? "running" : "success",
      message:
        activeSources.length > 0
          ? `Сбор агента «${agent.name}» запущен: ${activeSources.length} источников`
          : `У агента «${agent.name}» нет активных источников`,
      metadata: {
        agentName: agent.name,
        sourceCount: linkedSources.length,
        activeSourceCount: activeSources.length,
        sources: activeSources.map((source) => ({ id: source.id, name: source.name, type: source.type })),
      },
      startedAt: new Date(),
      finishedAt: activeSources.length > 0 ? null : new Date(),
    })
    .returning();

  // Queue actual BullMQ jobs for each active source
  if (activeSources.length > 0) {
    try {
      const { getFetchSourceQueue } = await import("../../lib/queues.js");
      const fetchQueue = getFetchSourceQueue();
      
      for (const source of activeSources) {
        await fetchQueue.add("fetch-source", {
          sourceId: source.id,
          agentId,
          workspaceId,
          userId,
          operationLogId: log.id,
        }, {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        });
      }
    } catch (err) {
      // If queue is not available (e.g. in dev), log but don't fail
      console.warn("[agents] BullMQ queue not available, collection logged but not queued:", (err as Error).message);
    }
  }

  return {
    operationId: log.id,
    op_id: log.id,
    status: log.status,
    message: log.message,
    sourceCount: linkedSources.length,
    activeSourceCount: activeSources.length,
  };
}
