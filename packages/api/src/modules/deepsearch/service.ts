import { and, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, deepsearchResults, workspaces } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { getDeepsearchQueue } from "../../lib/queues.js";
import { encrypt, decrypt } from "../../lib/encryption.js";
import { getArticleById } from "../articles/service.js";
import { createOperationLog } from "../operation-logs/service.js";

export interface StartDeepSearchInput {
  workspaceId: string;
  userId: string;
  articleId: string;
  agentId?: string;
  customPrompt?: string;
}

export type DeepsearchWebSearchProvider = "disabled" | "brave" | "tavily" | "serpapi" | "perplexity" | "grok";

export interface DeepsearchWebSearchSettingsInput {
  provider: DeepsearchWebSearchProvider;
  apiKey?: string;
  clearApiKey?: boolean;
  baseUrl?: string;
  model?: string;
  maxResults?: number;
}

export interface DeepsearchWebSearchSettingsView {
  provider: DeepsearchWebSearchProvider;
  hasApiKey: boolean;
  baseUrl?: string;
  model?: string;
  maxResults: number;
}

interface StoredDeepsearchWebSearchSettings {
  provider?: DeepsearchWebSearchProvider;
  apiKeyEncrypted?: string;
  baseUrl?: string;
  model?: string;
  maxResults?: number;
}

function normalizeMaxResults(value: unknown): number {
  const numberValue = Number(value ?? 8);
  if (!Number.isFinite(numberValue)) return 8;
  return Math.max(1, Math.min(Math.trunc(numberValue), 20));
}

function workspaceConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function storedWebSearchSettings(config: unknown): StoredDeepsearchWebSearchSettings {
  const root = workspaceConfig(config);
  return root.deepsearchWebSearch && typeof root.deepsearchWebSearch === "object"
    ? root.deepsearchWebSearch as StoredDeepsearchWebSearchSettings
    : {};
}

function toSettingsView(settings: StoredDeepsearchWebSearchSettings): DeepsearchWebSearchSettingsView {
  return {
    provider: settings.provider ?? "disabled",
    hasApiKey: Boolean(settings.apiKeyEncrypted),
    baseUrl: settings.baseUrl,
    model: settings.model,
    maxResults: normalizeMaxResults(settings.maxResults),
  };
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
      userId: input.userId,
      agentId,
      articleId: article.id,
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

export async function listDeepSearchResults(workspaceId: string, options?: { cursor?: string; limit?: number; agentId?: string }) {
  const limit = Math.max(1, Math.min(options?.limit ?? 20, 50));
  const conditions = [eq(deepsearchResults.workspaceId, workspaceId)];

  if (options?.agentId) {
    conditions.push(eq(deepsearchResults.agentId, options.agentId));
  }

  if (options?.cursor) {
    const cursorDate = new Date(options.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(deepsearchResults.createdAt, cursorDate));
    }
  }

  const rows = await db
    .select()
    .from(deepsearchResults)
    .where(and(...conditions))
    .orderBy(desc(deepsearchResults.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page.at(-1)?.createdAt?.toISOString() ?? null : null;

  return {
    data: page,
    next_cursor: nextCursor,
    has_more: Boolean(nextCursor),
  };
}

export async function deleteDeepSearchResult(id: string, workspaceId: string) {
  const [deleted] = await db
    .delete(deepsearchResults)
    .where(and(eq(deepsearchResults.id, id), eq(deepsearchResults.workspaceId, workspaceId)))
    .returning({ id: deepsearchResults.id });

  if (!deleted) {
    throw new AppError(404, "DeepSearch result not found", "DEEPSEARCH_NOT_FOUND");
  }
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

export async function getDeepsearchWebSearchSettings(workspaceId: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  }

  return toSettingsView(storedWebSearchSettings(workspace.config));
}

export async function updateDeepsearchWebSearchSettings(workspaceId: string, input: DeepsearchWebSearchSettingsInput) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  }

  const currentConfig = workspaceConfig(workspace.config);
  const currentSettings = storedWebSearchSettings(workspace.config);
  const nextSettings: StoredDeepsearchWebSearchSettings = {
    ...currentSettings,
    provider: input.provider,
    baseUrl: input.baseUrl?.trim() || undefined,
    model: input.model?.trim() || undefined,
    maxResults: normalizeMaxResults(input.maxResults),
  };

  if (input.clearApiKey) {
    delete nextSettings.apiKeyEncrypted;
  } else if (input.apiKey?.trim()) {
    nextSettings.apiKeyEncrypted = encrypt(input.apiKey.trim());
  }

  const [updated] = await db
    .update(workspaces)
    .set({
      config: {
        ...currentConfig,
        deepsearchWebSearch: nextSettings,
      },
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning();

  return toSettingsView(storedWebSearchSettings(updated.config));
}

export async function resolveDeepsearchWebSearchApiKey(workspaceId: string, transientApiKey?: string): Promise<string | undefined> {
  if (transientApiKey?.trim()) return transientApiKey.trim();

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  const stored = storedWebSearchSettings(workspace?.config);

  if (!stored.apiKeyEncrypted) return undefined;
  return decrypt(stored.apiKeyEncrypted);
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
