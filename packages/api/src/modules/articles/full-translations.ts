import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articleFullTranslations, articles, workspaces } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { getFullTranslateQueue } from "../../lib/queues.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";

async function assertWorkspace(workspaceId: string, userId: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)),
  });
  if (!workspace) {
    throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  }
  return workspace;
}

function mapRow(row: typeof articleFullTranslations.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    workspace_id: row.workspaceId,
    articleId: row.articleId,
    article_id: row.articleId,
    userId: row.userId,
    user_id: row.userId,
    status: row.status,
    sourceLang: row.sourceLang,
    source_lang: row.sourceLang,
    title: row.title,
    content: row.content,
    originalTitle: row.originalTitle,
    original_title: row.originalTitle,
    originalUrl: row.originalUrl,
    original_url: row.originalUrl,
    error: row.error,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    created_at: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    updated_at: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    completedAt: row.completedAt?.toISOString?.() ?? row.completedAt,
    completed_at: row.completedAt?.toISOString?.() ?? row.completedAt,
  };
}

export async function startFullTranslation(params: {
  workspaceId: string;
  userId: string;
  articleId: string;
}) {
  await assertWorkspace(params.workspaceId, params.userId);

  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      originalTitle: articles.originalTitle,
      link: articles.link,
      detectedLang: articles.detectedLang,
      workspaceId: articles.workspaceId,
    })
    .from(articles)
    .where(and(eq(articles.id, params.articleId), eq(articles.workspaceId, params.workspaceId)))
    .limit(1);

  if (!article) {
    throw new AppError(404, "Article not found", "ARTICLE_NOT_FOUND");
  }

  // Reuse an in-flight job for the same article instead of flooding the queue.
  const [existing] = await db
    .select()
    .from(articleFullTranslations)
    .where(
      and(
        eq(articleFullTranslations.workspaceId, params.workspaceId),
        eq(articleFullTranslations.articleId, params.articleId),
        sql`${articleFullTranslations.status} IN ('pending', 'running')`
      )
    )
    .orderBy(desc(articleFullTranslations.createdAt))
    .limit(1);

  if (existing) {
    return mapRow(existing);
  }

  const [created] = await db
    .insert(articleFullTranslations)
    .values({
      workspaceId: params.workspaceId,
      articleId: params.articleId,
      userId: params.userId,
      status: "pending",
      sourceLang: article.detectedLang,
      originalTitle: article.originalTitle || article.title,
      originalUrl: article.link,
      title: article.title,
    })
    .returning();

  const queue = getFullTranslateQueue();
  const jobId = `full-translate-${created.id}`;
  await queue.add(
    jobId,
    {
      translationId: created.id,
      articleId: params.articleId,
      workspaceId: params.workspaceId,
    },
    {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 8_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  return mapRow(created);
}

export async function listFullTranslations(params: {
  workspaceId: string;
  userId: string;
  limit: number;
  cursor?: string | null;
}) {
  await assertWorkspace(params.workspaceId, params.userId);

  const conditions = [eq(articleFullTranslations.workspaceId, params.workspaceId)];
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      const cursorDate = new Date(decoded.sortValue);
      if (!Number.isNaN(cursorDate.getTime())) {
        conditions.push(
          sql`(${articleFullTranslations.createdAt} < ${cursorDate}) OR (${articleFullTranslations.createdAt} = ${cursorDate} AND ${articleFullTranslations.id} < ${decoded.id})`
        );
      }
    }
  }

  const rows = await db
    .select()
    .from(articleFullTranslations)
    .where(and(...conditions))
    .orderBy(desc(articleFullTranslations.createdAt), desc(articleFullTranslations.id))
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  const page = hasMore ? rows.slice(0, params.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          id: last.id,
          sortValue: last.createdAt?.toISOString?.() ?? String(last.createdAt),
        })
      : null;

  return {
    data: page.map(mapRow),
    next_cursor: nextCursor,
    nextCursor,
    has_more: hasMore,
    hasMore,
  };
}

export async function getFullTranslation(params: {
  workspaceId: string;
  userId: string;
  id: string;
}) {
  await assertWorkspace(params.workspaceId, params.userId);
  const [row] = await db
    .select()
    .from(articleFullTranslations)
    .where(
      and(
        eq(articleFullTranslations.id, params.id),
        eq(articleFullTranslations.workspaceId, params.workspaceId)
      )
    )
    .limit(1);
  if (!row) throw new AppError(404, "Translation not found", "NOT_FOUND");
  return mapRow(row);
}

export async function deleteFullTranslation(params: {
  workspaceId: string;
  userId: string;
  id: string;
}) {
  await assertWorkspace(params.workspaceId, params.userId);
  const deleted = await db
    .delete(articleFullTranslations)
    .where(
      and(
        eq(articleFullTranslations.id, params.id),
        eq(articleFullTranslations.workspaceId, params.workspaceId)
      )
    )
    .returning({ id: articleFullTranslations.id });
  if (!deleted[0]) throw new AppError(404, "Translation not found", "NOT_FOUND");
  return { deleted: true, id: deleted[0].id };
}
