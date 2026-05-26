import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, deepsearchResults } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { getDeepsearchQueue } from "../../lib/queues.js";
import { getArticleById } from "../articles/service.js";
import { createOperationLog } from "../operation-logs/service.js";

export interface StartDeepSearchInput {
  workspaceId: string;
  userId: string;
  articleId: string;
  agentId?: string;
  customPrompt?: string;
}

export async function startDeepSearch(input: StartDeepSearchInput) {
  const article = await getArticleById(input.articleId, input.workspaceId);
  const agentId = input.agentId ?? article.agentId;

  if (!agentId) {
    throw new AppError(400, "DeepSearch requires an agent", "DEEPSEARCH_AGENT_REQUIRED");
  }

  const [result] = await db
    .insert(deepsearchResults)
    .values({
      workspaceId: input.workspaceId,
      agentId,
      query: article.title,
      status: "pending",
      findings: {
        articleId: article.id,
        articleTitle: article.title,
        articleUrl: article.link,
      },
    })
    .returning();

  const operationLog = await createOperationLog({
    userId: input.userId,
    workspaceId: input.workspaceId,
    agentId,
    operationType: "deepsearch",
    entityType: "deepsearch_result",
    entityId: result.id,
    status: "pending",
    message: "DeepSearch поставлен в очередь",
    metadata: {
      resultId: result.id,
      articleId: article.id,
      articleTitle: article.title,
      articleUrl: article.link,
      hasCustomPrompt: Boolean(input.customPrompt?.trim()),
    },
  });

  const queue = getDeepsearchQueue();
  await queue.add(
    `deepsearch-${result.id}`,
    {
      resultId: result.id,
      operationLogId: operationLog.id,
      userId: input.userId,
      workspaceId: input.workspaceId,
      agentId,
      articleId: article.id,
      customPrompt: input.customPrompt,
    },
    {
      jobId: result.id,
      removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
      removeOnFail: { age: 60 * 60 * 24 * 7, count: 1000 },
    }
  );

  return {
    operationId: result.id,
    op_id: result.id,
    resultId: result.id,
    operationLogId: operationLog.id,
    status: "queued",
  };
}

export async function getDeepSearchResult(id: string, workspaceId: string) {
  const result = await db.query.deepsearchResults.findFirst({
    where: and(eq(deepsearchResults.id, id), eq(deepsearchResults.workspaceId, workspaceId)),
  });

  if (!result) {
    throw new AppError(404, "DeepSearch result not found", "DEEPSEARCH_NOT_FOUND");
  }

  return result;
}

export async function getLatestDeepSearchForArticle(articleId: string, workspaceId: string) {
  const article = await getArticleById(articleId, workspaceId);
  const rows = await db
    .select()
    .from(deepsearchResults)
    .where(and(eq(deepsearchResults.workspaceId, workspaceId), eq(deepsearchResults.agentId, article.agentId)))
    .orderBy(desc(deepsearchResults.createdAt))
    .limit(20);

  const result = rows.find((row) => {
    const findings = row.findings as Record<string, unknown>;
    return findings.articleId === articleId;
  });

  if (!result) {
    throw new AppError(404, "DeepSearch result not found", "DEEPSEARCH_NOT_FOUND");
  }

  return result;
}

export async function listRelatedArticlesForDeepSearch(articleId: string, workspaceId: string, agentId: string) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      aiSummary: articles.aiSummary,
      link: articles.link,
      score: articles.score,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
    })
    .from(articles)
    .where(and(eq(articles.workspaceId, workspaceId), eq(articles.agentId, agentId), ne(articles.id, articleId)))
    .orderBy(desc(articles.score), desc(articles.createdAt))
    .limit(5);
}
