import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, sources, agentSources, articles, operationLogs } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { Agent, NewAgent } from "../../db/types.js";

// ─── CRUD ───

export async function createAgent(data: NewAgent) {
  const [agent] = await db.insert(agents).values(data).returning();
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
  data: Partial<Pick<Agent, "name" | "description" | "icon" | "color" | "position">>
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
        note: "Фоновая очередь сбора будет подключена следующим слоем ремонта",
      },
      startedAt: new Date(),
      finishedAt: activeSources.length > 0 ? null : new Date(),
    })
    .returning();

  return {
    operationId: log.id,
    op_id: log.id,
    status: log.status,
    message: log.message,
    sourceCount: linkedSources.length,
    activeSourceCount: activeSources.length,
  };
}