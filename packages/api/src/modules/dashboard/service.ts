import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, articles, operationLogs, workspaces } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";

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

  const [log] = await db
    .insert(operationLogs)
    .values({
      userId: params.userId,
      workspaceId: params.workspaceId,
      operationType: "collect_all",
      entityType: "workspace",
      entityId: params.workspaceId,
      status: activeAgents.length > 0 ? "running" : "success",
      message:
        activeAgents.length > 0
          ? `Сбор новостей запущен для ${activeAgents.length} агентов`
          : "Нет агентов для запуска сбора",
      metadata: {
        agentCount: activeAgents.length,
        agents: activeAgents.map((agent) => ({ id: agent.id, name: agent.name })),
        note: "Фоновая очередь сбора будет подключена следующим слоем ремонта",
      },
      startedAt: new Date(),
      finishedAt: activeAgents.length > 0 ? null : new Date(),
    })
    .returning();

  return {
    operationId: log.id,
    op_id: log.id,
    status: log.status,
    message: log.message,
    agentCount: activeAgents.length,
    agent_count: activeAgents.length,
  };
}
