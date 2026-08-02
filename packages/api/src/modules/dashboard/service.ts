import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, articles, operationLogs, workspaces, agentSources, sources } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { deduplicateCollectionSources, type CollectionSourceRef } from "./collection-sources.js";
import {
  getAllQueues,
  getScoreArticleQueue,
  getTranslateQueue,
} from "../../lib/queues.js";

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
    .where(and(eq(articles.workspaceId, params.workspaceId), ne(articles.status, "deduped")));

  const sourceCountRows = await db
    .select({ count: count(sources.id) })
    .from(sources)
    .where(eq(sources.workspaceId, params.workspaceId));

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
    sourceCount: Number(sourceCountRows[0]?.count ?? 0),
    source_count: Number(sourceCountRows[0]?.count ?? 0),
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
      },
      startedAt: new Date(),
      finishedAt: activeAgents.length > 0 ? null : new Date(),
    })
    .returning();

  // Queue fetch-source jobs for each agent's active sources
  let totalQueued = 0;
  if (activeAgents.length > 0) {
    try {
      const { getFetchSourceQueue } = await import("../../lib/queues.js");
      const fetchQueue = getFetchSourceQueue();
      const collectionSources: CollectionSourceRef[] = [];

      for (const agent of activeAgents) {
        const linkedSources = await db
          .select({ id: sources.id, name: sources.name })
          .from(agentSources)
          .innerJoin(sources, eq(agentSources.sourceId, sources.id))
          .where(and(eq(agentSources.agentId, agent.id), eq(sources.isActive, true)));

        collectionSources.push(...linkedSources);
      }

      for (const source of deduplicateCollectionSources(collectionSources)) {
        await fetchQueue.add("fetch-source", {
          sourceId: source.id,
          operationId: log.id,
        }, {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        });
        totalQueued++;
      }

      // Add delayed finalization job
      if (totalQueued > 0) {
        await fetchQueue.add("finalize-collection", {
          operationId: log.id,
          expectedCount: totalQueued,
        }, {
          delay: 120_000, // 2 minutes — enough for all sources
          attempts: 1,
          removeOnComplete: true,
        });
      }
    } catch (err) {
      const queueError = err instanceof Error ? err.message : String(err);
      console.error("[dashboard] Failed to queue collection jobs:", queueError);

      await db
        .update(operationLogs)
        .set({
          status: "failed",
          message: `Ошибка очереди: ${queueError}`,
          finishedAt: new Date(),
        })
        .where(eq(operationLogs.id, log.id));

      throw new AppError(500, `Ошибка очереди сбора: ${queueError}`, "QUEUE_ERROR");
    }
  }

  return {
    operationId: log.id,
    op_id: log.id,
    status: totalQueued > 0 ? "running" : log.status,
    message: totalQueued > 0
      ? `Сбор запущен: ${totalQueued} задач в очереди для ${activeAgents.length} агентов`
      : log.message,
    agentCount: activeAgents.length,
    agent_count: activeAgents.length,
    queuedCount: totalQueued,
    queued_count: totalQueued,
  };
}

/**
 * Pipeline status for status bar / dashboard:
 * how many articles are still being translated, analyzed or scored,
 * plus lightweight queue depths from BullMQ.
 */
export async function getPipelineStatus(params: { userId: string; workspaceId: string }) {
  await assertWorkspaceOwner(params);

  const [needsTranslationRows] = await db
    .select({ count: count(articles.id) })
    .from(articles)
    .where(
      and(
        eq(articles.workspaceId, params.workspaceId),
        eq(articles.needsTranslation, true),
        inArray(articles.status, ["new", "fetched", "translated"])
      )
    );

  const [fetchedRows] = await db
    .select({ count: count(articles.id) })
    .from(articles)
    .where(
      and(
        eq(articles.workspaceId, params.workspaceId),
        inArray(articles.status, ["fetched", "new"])
      )
    );

  const [translatedRows] = await db
    .select({ count: count(articles.id) })
    .from(articles)
    .where(and(eq(articles.workspaceId, params.workspaceId), eq(articles.status, "translated")));

  const [analyzedRows] = await db
    .select({ count: count(articles.id) })
    .from(articles)
    .where(and(eq(articles.workspaceId, params.workspaceId), eq(articles.status, "analyzed")));

  const [runningOps] = await db
    .select({ count: count(operationLogs.id) })
    .from(operationLogs)
    .where(
      and(
        eq(operationLogs.userId, params.userId),
        eq(operationLogs.workspaceId, params.workspaceId),
        inArray(operationLogs.status, ["running", "pending"])
      )
    );

  let queues: Record<string, { waiting: number; active: number; delayed: number; failed: number }> = {};
  try {
    const allQueues = getAllQueues();
    const stats = await Promise.all(
      allQueues.map(async (queue) => {
        const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
        return [
          queue.name,
          {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
          },
        ] as const;
      })
    );
    queues = Object.fromEntries(stats);
  } catch {
    queues = {};
  }

  const translating = Number(needsTranslationRows?.count ?? 0);
  const awaitingAnalysis = Number(translatedRows?.count ?? 0);
  const awaitingScoring = Number(analyzedRows?.count ?? 0);
  const fetchedPending = Number(fetchedRows?.count ?? 0);
  const activeOperations = Number(runningOps?.count ?? 0);

  const translateQ = queues["translate-v3"] ?? queues.translate ?? { waiting: 0, active: 0, delayed: 0, failed: 0 };
  const scoreQ = queues["score-article-v2"] ?? queues.score ?? { waiting: 0, active: 0, delayed: 0, failed: 0 };
  const ingestQ = queues["ingest-analysis-v2"] ?? queues["ingest-analysis"] ?? { waiting: 0, active: 0, delayed: 0, failed: 0 };

  const translateLive = (translateQ.active ?? 0) + (translateQ.waiting ?? 0);
  const ingestLive = (ingestQ.active ?? 0) + (ingestQ.waiting ?? 0);
  const scoreLive = (scoreQ.active ?? 0) + (scoreQ.waiting ?? 0);

  // "В работе" только если в BullMQ реально есть jobs.
  // DB backlog без очереди = застрявшие статьи (не крутим спиннер).
  const translatingStuck = Math.max(0, translating - translateLive);
  const analysisStuck = Math.max(0, awaitingAnalysis - ingestLive);
  const scoringStuck = Math.max(0, awaitingScoring - scoreLive);

  // Stale operation logs older than 30m should not keep the bar alive forever.
  const [freshRunningOps] = await db
    .select({ count: count(operationLogs.id) })
    .from(operationLogs)
    .where(
      and(
        eq(operationLogs.userId, params.userId),
        eq(operationLogs.workspaceId, params.workspaceId),
        inArray(operationLogs.status, ["running", "pending"]),
        sql`COALESCE(${operationLogs.startedAt}, ${operationLogs.createdAt}) > NOW() - INTERVAL '30 minutes'`
      )
    );
  const activeOperationsFresh = Number(freshRunningOps?.count ?? 0);

  const isBusy =
    translateLive > 0 ||
    ingestLive > 0 ||
    scoreLive > 0 ||
    activeOperationsFresh > 0;

  return {
    translating: translateLive,
    translatingBacklog: translating,
    translatingStuck,
    fetchedPending,
    awaitingAnalysis: ingestLive,
    analysisBacklog: awaitingAnalysis,
    analysisStuck,
    awaitingScoring: scoreLive,
    scoringBacklog: awaitingScoring,
    scoringStuck,
    activeOperations: activeOperationsFresh,
    activeOperationsAll: activeOperations,
    isBusy,
    queues: {
      translate: translateQ,
      ingest: ingestQ,
      scoring: scoreQ,
      all: queues,
    },
    // snake_case mirrors for frontend normalizers
    translating_backlog: translating,
    translating_stuck: translatingStuck,
    fetched_pending: fetchedPending,
    awaiting_analysis: ingestLive,
    analysis_backlog: awaitingAnalysis,
    analysis_stuck: analysisStuck,
    awaiting_scoring: scoreLive,
    scoring_backlog: awaitingScoring,
    scoring_stuck: scoringStuck,
    active_operations: activeOperationsFresh,
    active_operations_all: activeOperations,
    is_busy: isBusy,
  };
}

/**
 * Manually re-enqueue stuck pipeline articles for this workspace.
 * Use when status bar shows "Зависло" and heartbeat hasn't caught up yet.
 * Rescore alone does NOT help — those articles never reached scoring.
 */
export async function retryStuckPipeline(params: { userId: string; workspaceId: string }) {
  await assertWorkspaceOwner(params);
  const stamp = Date.now();
  const translateQueue = getTranslateQueue();
  const scoreQueue = getScoreArticleQueue();

  const clearedTerminalDuplicates = await db
    .update(articles)
    .set({ needsTranslation: false, updatedAt: new Date() })
    .where(
      and(
        eq(articles.workspaceId, params.workspaceId),
        eq(articles.status, "deduped"),
        eq(articles.needsTranslation, true)
      )
    )
    .returning({ id: articles.id });

  const needsTranslate = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.workspaceId, params.workspaceId),
        eq(articles.needsTranslation, true),
        inArray(articles.status, ["new", "fetched", "translated"])
      )
    )
    .limit(80);

  const stuckTranslated = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.workspaceId, params.workspaceId), eq(articles.status, "translated")))
    .limit(80);

  const stuckAnalyzed = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.workspaceId, params.workspaceId), eq(articles.status, "analyzed")))
    .limit(80);

  let translateQueued = 0;
  let ingestQueued = 0;
  let scoreQueued = 0;
  const errors: string[] = [];

  for (const row of needsTranslate) {
    const jobId = `manual-retranslate-${row.id}-${stamp}`;
    try {
      await translateQueue.add(
        jobId,
        { articleId: row.id, force: true },
        { jobId, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 }, attempts: 3 }
      );
      translateQueued += 1;
    } catch (err) {
      errors.push(`translate ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // status=translated means summary already done; advance straight to scoring
  for (const row of stuckTranslated) {
    const jobId = `manual-score-from-translated-${row.id}-${stamp}`;
    try {
      await db
        .update(articles)
        .set({ status: "analyzed", updatedAt: new Date() })
        .where(eq(articles.id, row.id));
      await scoreQueue.add(
        jobId,
        { articleId: row.id },
        { jobId, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 }, attempts: 3 }
      );
      scoreQueued += 1;
      ingestQueued += 1; // counted as "саммари advanced"
    } catch (err) {
      errors.push(`score-from-translated ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const row of stuckAnalyzed) {
    const jobId = `manual-rescore-${row.id}-${stamp}`;
    try {
      await scoreQueue.add(
        jobId,
        { articleId: row.id },
        { jobId, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 }, attempts: 3 }
      );
      scoreQueued += 1;
    } catch (err) {
      errors.push(`score ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Close stale running ops so status bar stays clean
  await db
    .update(operationLogs)
    .set({
      status: "failed",
      message: "Авто-закрыто: зависла >30 мин (pipeline retry)",
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(operationLogs.userId, params.userId),
        eq(operationLogs.workspaceId, params.workspaceId),
        inArray(operationLogs.status, ["running", "pending"]),
        sql`COALESCE(${operationLogs.startedAt}, ${operationLogs.createdAt}) < NOW() - INTERVAL '30 minutes'`
      )
    );

  return {
    translateQueued,
    ingestQueued,
    scoreQueued,
    totalQueued: translateQueued + ingestQueued + scoreQueued,
    dedupedCleared: clearedTerminalDuplicates.length,
    candidates: {
      translate: needsTranslate.length,
      ingest: stuckTranslated.length,
      score: stuckAnalyzed.length,
    },
    errors: errors.slice(0, 10),
    message:
      translateQueued + ingestQueued + scoreQueued > 0
        ? `Перезапущено: перевод ${translateQueued}, саммари ${ingestQueued}, скоринг ${scoreQueued}`
        : clearedTerminalDuplicates.length > 0
          ? `Исправлено: снят ложный флаг перевода у дублей — ${clearedTerminalDuplicates.length}`
          : "Нечего перезапускать — backlog пуст",
  };
}
