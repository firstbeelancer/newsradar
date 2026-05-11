import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, articles, operationLogs, workspaces, agentSources, sources } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { fetchSourceQueue } from "../../lib/queue.js";

async function assertWorkspaceOwner(params: { userId: string; workspaceId: string }) {
  const workspace = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.id, params.workspaceId), eq(workspaces.userId, params.userId)),
  });

  if (!workspace) {
    throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  }

  return workspace;
}

export async function getDashboardData(params: { userId: string; workspaceId: string }) {
  const workspace = await assertWorkspaceOwner(params);

  const agentRows = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      icon: agents.icon,
      color: agents.color,
      position: agents.position,
      createdAt: agents.createdAt,
      articleCount: count(articles.id),
    })
    .from(agents)
    .leftJoin(
      articles,
      and(eq(articles.agentId, agents.id), eq(articles.workspaceId, params.workspaceId))
    )
    .where(eq(agents.workspaceId, params.workspaceId))
    .groupBy(
      agents.id,
      agents.name,
      agents.description,
      agents.icon,
      agents.color,
      agents.position,
      agents.createdAt
    )
    .orderBy(agents.position, desc(agents.createdAt));

  const favoriteCountRows = await db
    .select({ count: count(articles.id) })
    .from(articles)
    .where(and(eq(articles.workspaceId, params.workspaceId), eq(articles.isFavorite, true)));

  const totalArticleRows = await db
    .select({ count: count(articles.id) })
    .from(articles)
    .where(eq(articles.workspaceId, params.workspaceId));

  const lastOperations = await db
    .select()
    .from(operationLogs)
    .where(and(eq(operationLogs.userId, params.userId), eq(operationLogs.workspaceId, params.workspaceId)))
    .orderBy(desc(operationLogs.createdAt))
    .limit(10);

  const favoriteLimit = workspace.plan === "pro" ? 1000 : 100;

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
    },
    agents: agentRows.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      color: agent.color,
      position: agent.position,
      article_count: Number(agent.articleCount ?? 0),
      articleCount: Number(agent.articleCount ?? 0),
      is_active: true,
      isActive: true,
    })),
    favoriteCount: Number(favoriteCountRows[0]?.count ?? 0),
    favorite_count: Number(favoriteCountRows[0]?.count ?? 0),
    favoriteLimit,
    favorite_limit: favoriteLimit,
    totalArticles: Number(totalArticleRows[0]?.count ?? 0),
    total_articles: Number(totalArticleRows[0]?.count ?? 0),
    lastOperations: lastOperations.map((log) => ({
      id: log.id,
      agentId: log.agentId,
      agent_id: log.agentId,
      operationType: log.operationType,
      operation_type: log.operationType,
      status: log.status,
      message: log.message,
      metadata: log.metadata,
      startedAt: log.startedAt,
      started_at: log.startedAt,
      finishedAt: log.finishedAt,
      finished_at: log.finishedAt,
      createdAt: log.createdAt,
      created_at: log.createdAt,
    })),
  };
}

export async function collectAllAgents(params: { userId: string; workspaceId: string }) {
  await assertWorkspaceOwner(params);

  const activeAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.workspaceId, params.workspaceId))
    .orderBy(agents.position, desc(agents.createdAt));

  if (activeAgents.length === 0) {
    const [log] = await db
      .insert(operationLogs)
      .values({
        userId: params.userId,
        workspaceId: params.workspaceId,
        operationType: "collect_all",
        entityType: "workspace",
        entityId: params.workspaceId,
        status: "success",
        message: "Нет агентов для запуска сбора",
        metadata: { agentCount: 0, agents: [] },
        startedAt: new Date(),
        finishedAt: new Date(),
      })
      .returning();

    return {
      operationId: log.id,
      op_id: log.id,
      status: log.status,
      message: log.message,
      agentCount: 0,
      agent_count: 0,
    };
  }

  // Create operation log in "running" state
  const [log] = await db
    .insert(operationLogs)
    .values({
      userId: params.userId,
      workspaceId: params.workspaceId,
      operationType: "collect_all",
      entityType: "workspace",
      entityId: params.workspaceId,
      status: "running",
      message: `Сбор новостей запущен для ${activeAgents.length} агентов`,
      metadata: {
        agentCount: activeAgents.length,
        agents: activeAgents.map((a) => ({ id: a.id, name: a.name })),
      },
      startedAt: new Date(),
    })
    .returning();

  // Actually enqueue fetch jobs for each agent's active sources
  let totalEnqueued = 0;
  const errors: string[] = [];

  for (const agent of activeAgents) {
    try {
      // Get active sources for this agent
      const linkedSources = await db
        .select({ sourceId: agentSources.sourceId })
        .from(agentSources)
        .where(eq(agentSources.agentId, agent.id));

      for (const link of linkedSources) {
        const sourceRow = await db
          .select({ id: sources.id, name: sources.name, type: sources.type, isActive: sources.isActive })
          .from(sources)
          .where(eq(sources.id, link.sourceId))
          .limit(1);

        const source = sourceRow[0];
        if (!source || !source.isActive) continue;

        await fetchSourceQueue.add(
          "fetch-source",
          {
            sourceId: source.id,
            agentId: agent.id,
            workspaceId: params.workspaceId,
            operationId: log.id,
            userId: params.userId,
          },
          {
            jobId: `fetch:${source.id}:${Date.now()}`,
            delay: Math.random() * 500, // Stagger to avoid thundering herd
          }
        );
        totalEnqueued++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Agent ${agent.name}: ${msg}`);
    }
  }

  // Update operation log with results
  await db
    .update(operationLogs)
    .set({
      metadata: {
        agentCount: activeAgents.length,
        agents: activeAgents.map((a) => ({ id: a.id, name: a.name })),
        enqueuedJobs: totalEnqueued,
        errors: errors.length > 0 ? errors : undefined,
      },
      finishedAt: errors.length === 0 ? new Date() : null,
      status: errors.length === 0 ? "success" : errors.length < activeAgents.length ? "partial" : "failed",
    })
    .where(eq(operationLogs.id, log.id));

  return {
    operationId: log.id,
    op_id: log.id,
    status: totalEnqueued > 0 ? "running" : "failed",
    message: totalEnqueued > 0
      ? `Сбор запущен: ${totalEnqueued} задач в очереди для ${activeAgents.length} агентов`
      : "Не удалось поставить задачи в очередь",
    agentCount: activeAgents.length,
    agent_count: activeAgents.length,
    enqueuedJobs: totalEnqueued,
  };
}
