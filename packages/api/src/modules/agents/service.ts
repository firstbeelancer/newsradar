import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, sources, agentSources, articles, operationLogs, subjectAreas, chipFilters } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { Agent, NewAgent } from "../../db/types.js";
import { fetchSourceQueue } from "../../lib/queue.js";

// ─── CRUD ───

export async function createAgent(data: NewAgent & { workspaceId: string }) {
  const { workspaceId, subjectArea, ...agentData } = data;

  // If subjectArea is provided, load its defaults
  let config: Record<string, unknown> = (agentData as any).config ?? {};

  if (subjectArea) {
    try {
      const areaRows = await db
        .select()
        .from(subjectAreas)
        .where(eq(subjectAreas.id, subjectArea))
        .limit(1);

      const area = areaRows[0];
      if (area) {
        const defaults = area.defaultsJson as Record<string, unknown> ?? {};

        // Copy scoring_weights from subject area into agent.config
        if (defaults.scoring_weights) {
          config = {
            ...config,
            scoring_weights: defaults.scoring_weights,
          };
        }

        // Create the agent first
        const [agent] = await db.insert(agents).values({
          ...agentData,
          workspaceId,
          subjectArea,
          config,
        }).returning();

        // Create default sources from subject area and link them
        if (defaults.default_sources && Array.isArray(defaults.default_sources)) {
          const sourceDefs = defaults.default_sources as Array<{
            type: string;
            name: string;
            url: string;
          }>;

          for (const srcDef of sourceDefs) {
            try {
              // Create source in the workspace
              const [source] = await db.insert(sources).values({
                type: srcDef.type || 'rss',
                name: srcDef.name,
                url: srcDef.url,
                workspaceId,
                isActive: true,
              }).returning();

              // Link source to agent
              await db.insert(agentSources).values({
                agentId: agent.id,
                sourceId: source.id,
              }).onConflictDoNothing({ target: [agentSources.agentId, agentSources.sourceId] });
            } catch (err) {
              // Source may already exist, try to find and link it
              try {
                const existing = await db
                  .select({ id: sources.id })
                  .from(sources)
                  .where(and(eq(sources.url, srcDef.url), eq(sources.workspaceId, workspaceId)))
                  .limit(1);

                if (existing[0]) {
                  await db.insert(agentSources).values({
                    agentId: agent.id,
                    sourceId: existing[0].id,
                  }).onConflictDoNothing({ target: [agentSources.agentId, agentSources.sourceId] });
                }
              } catch {
                // Skip this source on error
              }
            }
          }
        }

        // Create chip filters from subject area defaults
        if (defaults.chip_filters && Array.isArray(defaults.chip_filters)) {
          const chipDefs = defaults.chip_filters as Array<{
            key: string;
            label: string;
            score_modifier?: number;
            color?: string;
            pattern?: string;
          }>;

          for (let i = 0; i < chipDefs.length; i++) {
            const chipDef = chipDefs[i];
            try {
              await db.insert(chipFilters).values({
                agentId: agent.id,
                key: chipDef.key,
                label: chipDef.label,
                scoreModifier: String(chipDef.score_modifier ?? 0),
                color: chipDef.color ?? 'default',
                pattern: chipDef.pattern ?? chipDef.key,
                operator: 'contains',
                position: i,
                isActive: true,
              });
            } catch {
              // Skip on error (may already exist)
            }
          }
        }

        return agent;
      }
    } catch (err) {
      // Subject area may not exist, continue without defaults
      console.error('[createAgent] Error loading subject area defaults:', err instanceof Error ? err.message : String(err));
    }
  }

  // No subject area or failed to load defaults — create agent normally
  const [agent] = await db.insert(agents).values({
    ...agentData,
    workspaceId,
    subjectArea,
    config,
  }).returning();

  return agent;
}

export async function getAgentById(id: string, workspaceId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }
  return agent;
}

export async function listAgents(
  workspaceId: string,
  params: { limit: number; cursor?: string | null }
): Promise<PaginatedResult<Agent>> {
  const conditions = [eq(agents.workspaceId, workspaceId)];

  const baseQuery = db
    .select()
    .from(agents)
    .where(and(...conditions))
    .orderBy(agents.position, desc(agents.createdAt))
    .limit(params.limit + 1);

  let query = baseQuery;

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      query = db
        .select()
        .from(agents)
        .where(
          and(
            ...conditions,
            sql`${agents.createdAt} < ${new Date(decoded.sortValue)}`
          )
        )
        .orderBy(agents.position, desc(agents.createdAt))
        .limit(params.limit + 1);
    }
  }

  const rows = await query;
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
  data: Partial<Pick<Agent, "name" | "description" | "icon" | "color" | "subjectArea" | "position">>
) {
  await getAgentById(id, workspaceId);

  const [updated] = await db
    .update(agents)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function deleteAgent(id: string, workspaceId: string) {
  await getAgentById(id, workspaceId);
  await db.delete(agents).where(and(eq(agents.id, id), eq(agents.workspaceId, workspaceId)));
  return { deleted: true };
}

// ─── Stats ───

export async function getAgentStats(id: string, workspaceId: string) {
  await getAgentById(id, workspaceId);

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
    total_sources: Number(sourceCountResult[0]?.count ?? 0),
    total_articles: Number(articleCountResult[0]?.count ?? 0),
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
  await getAgentById(agentId, workspaceId);

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
  await getAgentById(agentId, workspaceId);

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
  await getAgentById(agentId, workspaceId);

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
  const agent = await getAgentById(agentId, workspaceId);

  const linkedSources = await getAgentSources(agentId, workspaceId);
  const activeSources = linkedSources.filter((source) => source.isActive);

  if (activeSources.length === 0) {
    const [log] = await db
      .insert(operationLogs)
      .values({
        userId,
        workspaceId,
        agentId,
        operationType: "collect_agent",
        entityType: "agent",
        entityId: agentId,
        status: "success",
        message: `У агента «${agent.name}» нет активных источников`,
        metadata: {
          agentName: agent.name,
          sourceCount: linkedSources.length,
          activeSourceCount: 0,
        },
        startedAt: new Date(),
        finishedAt: new Date(),
      })
      .returning();

    return {
      operationId: log.id,
      op_id: log.id,
      status: log.status,
      message: log.message,
      sourceCount: linkedSources.length,
      activeSourceCount: 0,
    };
  }

  const [log] = await db
    .insert(operationLogs)
    .values({
      userId,
      workspaceId,
      agentId,
      operationType: "collect_agent",
      entityType: "agent",
      entityId: agentId,
      status: "running",
      message: `Сбор агента «${agent.name}» запущен: ${activeSources.length} источников`,
      metadata: {
        agentName: agent.name,
        sourceCount: linkedSources.length,
        activeSourceCount: activeSources.length,
        sourceIds: activeSources.map((s) => s.id),
      },
      startedAt: new Date(),
    })
    .returning();

  const jobPromises = activeSources.map((source) =>
    fetchSourceQueue.add(
      "fetch-source",
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        sourceUrl: source.url,
        agentId,
        workspaceId,
        operationId: log.id,
        userId,
      },
      {
        jobId: `fetch:${source.id}:${Date.now()}`,
        delay: Math.random() * 500,
      }
    )
  );

  try {
    const jobs = await Promise.all(jobPromises);
    const jobIds = jobs.map((j) => j.id ?? "unknown");

    await db
      .update(operationLogs)
      .set({
        metadata: {
          agentName: agent.name,
          sourceCount: linkedSources.length,
          activeSourceCount: activeSources.length,
          sourceIds: activeSources.map((s) => s.id),
          enqueuedJobIds: jobIds,
        },
      })
      .where(eq(operationLogs.id, log.id));
  } catch (queueErr) {
    console.error(
      "[triggerCollection] Failed to enqueue fetch-source jobs:",
      queueErr instanceof Error ? queueErr.message : String(queueErr)
    );

    await db
      .update(operationLogs)
      .set({
        status: "failed",
        message: `Ошибка постановки в очередь: ${queueErr instanceof Error ? queueErr.message : String(queueErr)}`,
        finishedAt: new Date(),
        metadata: {
          agentName: agent.name,
          sourceCount: linkedSources.length,
          activeSourceCount: activeSources.length,
          enqueueError: queueErr instanceof Error ? queueErr.message : String(queueErr),
        },
      })
      .where(eq(operationLogs.id, log.id));

    return {
      operationId: log.id,
      op_id: log.id,
      status: "failed",
      message: `Ошибка постановки в очередь: ${queueErr instanceof Error ? queueErr.message : String(queueErr)}`,
      sourceCount: linkedSources.length,
      activeSourceCount: activeSources.length,
    };
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
