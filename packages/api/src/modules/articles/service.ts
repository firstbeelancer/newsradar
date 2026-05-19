import { eq, and, desc, asc, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, articleScores, sources } from "../../db/schema.js";
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
  sortBy?: "date" | "score";
  sortOrder?: "asc" | "desc";
  limit: number;
  cursor?: string | null;
}

// ─── CRUD ───

export async function getArticleById(id: string, workspaceId: string) {
  const result = await db
    .select({
      articles: articles,
      sourceName: sources.name,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
    .limit(1);

  if (!result[0]) {
    throw new AppError(404, "Article not found", "ARTICLE_NOT_FOUND");
  }
  return { ...result[0].articles, source_name: result[0].sourceName };
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

  const sortBy = filters.sortBy ?? "date";
  const sortOrder = filters.sortOrder ?? "desc";
  const orderFn = sortOrder === "asc" ? asc : desc;

  const orderByClause =
    sortBy === "score"
      ? [orderFn(articles.score), orderFn(articles.publishedAt ?? articles.createdAt), orderFn(articles.id)]
      : [orderFn(articles.publishedAt ?? articles.createdAt), orderFn(articles.id)];

  let query = db
    .select({
      articles: articles,
      sourceName: sources.name,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(and(...conditions))
    .orderBy(...orderByClause)
    .limit(filters.limit + 1);

  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (decoded?.sortValue) {
      if (sortBy === "score") {
        const sortValue = Number(decoded.sortValue);
        const cursorDate = decoded.secondarySortValue ? new Date(decoded.secondarySortValue) : new Date(decoded.sortValue);
        if (sortOrder === "desc") {
          conditions.push(
            sql`(${articles.score} < ${sortValue}) OR (${articles.score} = ${sortValue} AND ${articles.publishedAt} < ${cursorDate})`
          );
        } else {
          conditions.push(
            sql`(${articles.score} > ${sortValue}) OR (${articles.score} = ${sortValue} AND ${articles.publishedAt} > ${cursorDate})`
          );
        }
      } else {
        const cursorDate = new Date(decoded.sortValue);
        if (sortOrder === "desc") {
          conditions.push(
            sql`(${articles.publishedAt} IS NOT NULL AND ${articles.publishedAt} < ${cursorDate}) OR (${articles.publishedAt} IS NULL AND ${articles.createdAt} < ${cursorDate})`
          );
        } else {
          conditions.push(
            sql`(${articles.publishedAt} IS NOT NULL AND ${articles.publishedAt} > ${cursorDate}) OR (${articles.publishedAt} IS NULL AND ${articles.createdAt} > ${cursorDate})`
          );
        }
      }
      query = db
        .select({
          articles: articles,
          sourceName: sources.name,
        })
        .from(articles)
        .leftJoin(sources, eq(articles.sourceId, sources.id))
        .where(and(...conditions))
        .orderBy(...orderByClause)
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
          id: lastItem.articles.id,
          sortValue: sortBy === "score"
            ? lastItem.articles.score.toString()
            : (lastItem.articles.publishedAt ?? lastItem.articles.createdAt).toISOString(),
          secondarySortValue: sortBy === "score"
            ? (lastItem.articles.publishedAt ?? lastItem.articles.createdAt).toISOString()
            : undefined,
        } as Cursor)
      : null;

  return { data: data.map((r) => ({ ...r.articles, source_name: r.sourceName })), nextCursor, hasMore };
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
    .select({
      articles: articles,
      sourceName: sources.name,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
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
        .select({
          articles: articles,
          sourceName: sources.name,
        })
        .from(articles)
        .leftJoin(sources, eq(articles.sourceId, sources.id))
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
          id: lastItem.articles.id,
          sortValue: lastItem.articles.score.toString(),
        } as Cursor)
      : null;

  return { data: data.map((r) => ({ ...r.articles, source_name: r.sourceName })), nextCursor, hasMore };
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

export async function ensureArticleExists(id: string, workspaceId: string) {
  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      language: articles.language,
      detectedLang: articles.detectedLang,
      needsTranslation: articles.needsTranslation,
      status: articles.status,
    })
    .from(articles)
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new AppError(404, "Article not found", "ARTICLE_NOT_FOUND");
  }

  return article;
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

export async function deleteAllArticles(workspaceId: string) {
  const deleted = await db
    .delete(articles)
    .where(eq(articles.workspaceId, workspaceId))
    .returning({ id: articles.id });

  return { deleted: deleted.length };
}

// ─── Article with score details ───

export async function getArticleWithScore(id: string, workspaceId: string) {
  const article = await getArticleById(id, workspaceId);

  const scoreDetails = await db.query.articleScores.findFirst({
    where: eq(articleScores.articleId, id),
  });

  return { article, score: scoreDetails ?? null };
}
