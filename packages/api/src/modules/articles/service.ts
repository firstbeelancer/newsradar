import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, articleScores } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { Article } from "../../db/types.js";

// ─── Types ───

export interface ArticleFilters {
  workspaceId: string;
  agentId?: string;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  isFavorite?: boolean;
  limit: number;
  cursor?: string | null;
}

// ─── CRUD ───

export async function getArticleById(id: string, workspaceId: string) {
  const article = await db.query.articles.findFirst({
    where: and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)),
  });
  if (!article) {
    throw new AppError(404, "Article not found", "ARTICLE_NOT_FOUND");
  }
  return article;
}

// ─── Cursor-based list with filters ───

export async function listArticles(
  filters: ArticleFilters
): Promise<PaginatedResult<Article>> {
  const conditions: SQL[] = [eq(articles.workspaceId, filters.workspaceId)];

  if (filters.agentId) {
    conditions.push(eq(articles.agentId, filters.agentId));
  }
  if (filters.status) {
    conditions.push(eq(articles.status, filters.status));
  }
  if (filters.isFavorite !== undefined) {
    conditions.push(eq(articles.isFavorite, filters.isFavorite));
  }
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    if (!isNaN(fromDate.getTime())) {
      conditions.push(sql`${articles.publishedAt} >= ${fromDate}`);
    }
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    if (!isNaN(toDate.getTime())) {
      conditions.push(sql`${articles.publishedAt} <= ${toDate}`);
    }
  }
  if (filters.search) {
    // Full-text search using the GIN index
    const tsQuery = filters.search
      .trim()
      .split(/\s+/)
      .map((w) => w + ":*")
      .join(" & ");
    conditions.push(
      sql`to_tsvector('russian', ${articles.title} || ' ' || COALESCE(${articles.description}, '')) @@ to_tsquery('russian', ${tsQuery})`
    );
  }

  let query = db
    .select()
    .from(articles)
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt ?? articles.createdAt), desc(articles.id))
    .limit(filters.limit + 1);

  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (decoded?.sortValue) {
      const cursorDate = new Date(decoded.sortValue);
      conditions.push(
        sql`(${articles.publishedAt} IS NOT NULL AND ${articles.publishedAt} < ${cursorDate}) OR (${articles.publishedAt} IS NULL AND ${articles.createdAt} < ${cursorDate})`
      );
      query = db
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.publishedAt ?? articles.createdAt), desc(articles.id))
        .limit(filters.limit + 1);
    }
  }

  const rows = await query;
  const hasMore = rows.length > filters.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;

  const lastItem = data[data.length - 1];
  const nextCursor: string | null =
    hasMore && lastItem
      ? encodeCursor({
          id: lastItem.id,
          sortValue: (lastItem.publishedAt ?? lastItem.createdAt).toISOString(),
        } as Cursor)
      : null;

  return { data, nextCursor, hasMore };
}

// ─── Full-text search (dedicated endpoint) ───

export async function searchArticles(
  workspaceId: string,
  queryText: string,
  params: { limit: number; cursor?: string | null }
): Promise<PaginatedResult<Article>> {
  if (!queryText || queryText.trim().length < 2) {
    throw new AppError(400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }

  const tsQuery = queryText
    .trim()
    .split(/\s+/)
    .map((w) => w + ":*")
    .join(" & ");

  const conditions = [
    eq(articles.workspaceId, workspaceId),
    sql`to_tsvector('russian', ${articles.title} || ' ' || COALESCE(${articles.description}, '')) @@ to_tsquery('russian', ${tsQuery})`,
  ];

  let query = db
    .select()
    .from(articles)
    .where(and(...conditions))
    .orderBy(desc(articles.score), desc(articles.publishedAt ?? articles.createdAt))
    .limit(params.limit + 1);

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      conditions.push(
        sql`${articles.score} < ${decoded.sortValue}`
      );
      query = db
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.score), desc(articles.publishedAt ?? articles.createdAt))
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
          sortValue: lastItem.score.toString(),
        } as Cursor)
      : null;

  return { data, nextCursor, hasMore };
}

// ─── Favorites ───

export async function addToFavorite(id: string, workspaceId: string) {
  await getArticleById(id, workspaceId);

  const [updated] = await db
    .update(articles)
    .set({ isFavorite: true, updatedAt: new Date() })
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function removeFromFavorite(id: string, workspaceId: string) {
  await getArticleById(id, workspaceId);

  const [updated] = await db
    .update(articles)
    .set({ isFavorite: false, updatedAt: new Date() })
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function listFavorites(
  workspaceId: string,
  params: { limit: number; cursor?: string | null }
): Promise<PaginatedResult<Article>> {
  return listArticles({
    workspaceId,
    isFavorite: true,
    limit: params.limit,
    cursor: params.cursor ?? null,
  });
}

// ─── Article with score details ───

export async function getArticleWithScore(id: string, workspaceId: string) {
  const article = await getArticleById(id, workspaceId);

  const scoreDetails = await db.query.articleScores.findFirst({
    where: eq(articleScores.articleId, id),
  });

  return { article, score: scoreDetails ?? null };
}
