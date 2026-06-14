import { eq, and, desc, asc, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, articles, articleScores, favoriteArticles, sources, workspaces } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { Article } from "../../db/types.js";

// ─── Types ───

export interface ArticleFilters {
  workspaceId: string;
  agentId?: string;
  sourceId?: string;
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

function buildArticleConditions(filters: ArticleFilters): SQL[] {
  const conditions: SQL[] = [eq(articles.workspaceId, filters.workspaceId)];

  if (filters.agentId) {
    conditions.push(eq(articles.agentId, filters.agentId));
  }
  if (filters.sourceId) {
    conditions.push(eq(articles.sourceId, filters.sourceId));
  }
  if (filters.status) {
    conditions.push(eq(articles.status, filters.status));
  } else {
    conditions.push(sql`NOT (${articles.status} = 'fetched' AND ${articles.needsTranslation} = true)`);
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
    const tsQuery = filters.search
      .trim()
      .split(/\s+/)
      .map((w) => w + ":*")
      .join(" & ");
    conditions.push(
      sql`to_tsvector('russian', ${articles.title} || ' ' || COALESCE(${articles.description}, '')) @@ to_tsquery('russian', ${tsQuery})`
    );
  }

  return conditions;
}

function buildDateCursorCondition(sortDateExpr: SQL<Date>, cursor: Cursor, sortOrder: "asc" | "desc"): SQL | null {
  if (!cursor.sortValue) return null;

  const cursorDate = new Date(cursor.sortValue);
  if (isNaN(cursorDate.getTime())) return null;

  const condition = sortOrder === "desc"
    ? sql`(${sortDateExpr} < ${cursorDate}) OR (${sortDateExpr} = ${cursorDate} AND ${articles.id} < ${cursor.id})`
    : sql`(${sortDateExpr} > ${cursorDate}) OR (${sortDateExpr} = ${cursorDate} AND ${articles.id} > ${cursor.id})`;

  return sql`(${condition})`;
}

function buildScoreCursorCondition(sortDateExpr: SQL<Date>, cursor: Cursor, sortOrder: "asc" | "desc"): SQL | null {
  if (!cursor.sortValue) return null;

  const scoreValue = Number(cursor.sortValue);
  const cursorDateValue = cursor.secondarySortValue ?? cursor.sortValue;
  const cursorDate = new Date(cursorDateValue);
  if (!Number.isFinite(scoreValue) || isNaN(cursorDate.getTime())) return null;

  const dateTieCondition = sortOrder === "desc"
    ? sql`(${sortDateExpr} < ${cursorDate}) OR (${sortDateExpr} = ${cursorDate} AND ${articles.id} < ${cursor.id})`
    : sql`(${sortDateExpr} > ${cursorDate}) OR (${sortDateExpr} = ${cursorDate} AND ${articles.id} > ${cursor.id})`;

  const condition = sortOrder === "desc"
    ? sql`${articles.score} < ${scoreValue} OR (${articles.score} = ${scoreValue} AND (${dateTieCondition}))`
    : sql`${articles.score} > ${scoreValue} OR (${articles.score} = ${scoreValue} AND (${dateTieCondition}))`;

  return sql`(${condition})`;
}

// ─── CRUD ───

export async function getArticleById(id: string, workspaceId: string) {
  const result = await db
    .select({
      articles: articles,
      sourceName: sources.name,
      agentName: agents.name,
      agentColor: agents.color,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .leftJoin(agents, eq(articles.agentId, agents.id))
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
    .limit(1);

  if (!result[0]) {
    throw new AppError(404, "Article not found", "ARTICLE_NOT_FOUND");
  }
  return {
    ...result[0].articles,
    source_name: result[0].sourceName,
    agent_name: result[0].agentName,
    agent_color: result[0].agentColor,
  };
}

// ─── Cursor-based list with filters ───

export async function listArticles(
  filters: ArticleFilters
): Promise<PaginatedResult<Article>> {
  const conditions = buildArticleConditions(filters);

  const sortBy = filters.sortBy ?? "date";
  const sortOrder = filters.sortOrder ?? "desc";
  const orderFn = sortOrder === "asc" ? asc : desc;

  // Use SQL COALESCE for publishedAt fallback to createdAt — JS ?? doesn't work with Drizzle columns
  const sortDateExpr = sql<Date>`coalesce(${articles.publishedAt}, ${articles.createdAt})`;

  const orderByClause =
    sortBy === "score"
      ? [orderFn(articles.score), orderFn(sortDateExpr), orderFn(articles.id)]
      : [orderFn(sortDateExpr), orderFn(articles.id)];

  let query = db
    .select({
      articles: articles,
      sourceName: sources.name,
      agentName: agents.name,
      agentColor: agents.color,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .leftJoin(agents, eq(articles.agentId, agents.id))
    .where(and(...conditions))
    .orderBy(...orderByClause)
    .limit(filters.limit + 1);

  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (decoded?.sortValue) {
      const cursorCondition = sortBy === "score"
        ? buildScoreCursorCondition(sortDateExpr, decoded, sortOrder)
        : buildDateCursorCondition(sortDateExpr, decoded, sortOrder);

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }

      query = db
        .select({
          articles: articles,
          sourceName: sources.name,
          agentName: agents.name,
          agentColor: agents.color,
        })
        .from(articles)
        .leftJoin(sources, eq(articles.sourceId, sources.id))
        .leftJoin(agents, eq(articles.agentId, agents.id))
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

  return {
    data: data.map((r) => ({
      ...r.articles,
      source_name: r.sourceName,
      agent_name: r.agentName,
      agent_color: r.agentColor,
    })),
    nextCursor,
    hasMore,
  };
}

export async function listArticleSelectionIds(filters: ArticleFilters & { maxIds: number }) {
  const conditions = buildArticleConditions(filters);
  const rows = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(...conditions))
    .orderBy(desc(sql<Date>`coalesce(${articles.publishedAt}, ${articles.createdAt})`), desc(articles.id))
    .limit(filters.maxIds + 1);

  const limitedRows = rows.slice(0, filters.maxIds);
  return {
    articleIds: limitedRows.map((row) => row.id),
    selectedCount: limitedRows.length,
    capped: rows.length > filters.maxIds,
    maxIds: filters.maxIds,
  };
}

// ─── Full-text search (dedicated endpoint) ───

export async function searchArticles(
  workspaceId: string,
  queryText: string,
  params: { limit: number; cursor?: string | null; agentId?: string; sourceId?: string; isFavorite?: boolean }
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
  if (params.agentId) {
    conditions.push(eq(articles.agentId, params.agentId));
  }
  if (params.sourceId) {
    conditions.push(eq(articles.sourceId, params.sourceId));
  }
  if (params.isFavorite !== undefined) {
    conditions.push(eq(articles.isFavorite, params.isFavorite));
  }

  let query = db
    .select({
      articles: articles,
      sourceName: sources.name,
      agentName: agents.name,
      agentColor: agents.color,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .leftJoin(agents, eq(articles.agentId, agents.id))
    .where(and(...conditions))
    .orderBy(desc(articles.score), desc(sql<Date>`coalesce(${articles.publishedAt}, ${articles.createdAt})`))
    .limit(params.limit + 1);

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      const sortDateExpr = sql<Date>`coalesce(${articles.publishedAt}, ${articles.createdAt})`;
      const cursorCondition = buildScoreCursorCondition(sortDateExpr, decoded, "desc");
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
      query = db
        .select({
          articles: articles,
          sourceName: sources.name,
          agentName: agents.name,
          agentColor: agents.color,
        })
        .from(articles)
        .leftJoin(sources, eq(articles.sourceId, sources.id))
        .leftJoin(agents, eq(articles.agentId, agents.id))
        .where(and(...conditions))
        .orderBy(desc(articles.score), desc(sql<Date>`coalesce(${articles.publishedAt}, ${articles.createdAt})`))
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
          secondarySortValue: (lastItem.articles.publishedAt ?? lastItem.articles.createdAt).toISOString(),
        } as Cursor)
      : null;

  return {
    data: data.map((r) => ({
      ...r.articles,
      source_name: r.sourceName,
      agent_name: r.agentName,
      agent_color: r.agentColor,
    })),
    nextCursor,
    hasMore,
  };
}

// ─── Favorites ───

function favoriteLimitForPlan(plan: string): number {
  return plan === "pro" || plan === "enterprise" ? 1000 : 100;
}

function favoriteExpiresAt(ttlMode: "30d" | "forever"): Date | null {
  if (ttlMode === "forever") return null;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt;
}

export async function addToFavorite(
  id: string,
  workspaceId: string,
  options: { ttlMode?: "30d" | "forever"; note?: string } = {}
) {
  const article = await getArticleById(id, workspaceId);
  const ttlMode = options.ttlMode ?? "30d";

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    columns: { plan: true },
  });
  const limit = favoriteLimitForPlan(workspace?.plan ?? "free");
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(favoriteArticles)
    .where(eq(favoriteArticles.workspaceId, workspaceId));
  const currentCount = Number(countResult[0]?.count ?? 0);

  const existing = await db.query.favoriteArticles.findFirst({
    where: and(eq(favoriteArticles.workspaceId, workspaceId), eq(favoriteArticles.articleId, id)),
  });

  if (!existing && currentCount >= limit) {
    throw new AppError(403, `Favorites limit reached: ${currentCount}/${limit}`, "FAVORITES_LIMIT_REACHED");
  }

  await db
    .insert(favoriteArticles)
    .values({
      workspaceId,
      articleId: id,
      agentId: article.agentId,
      sourceId: article.sourceId,
      ttlMode,
      expiresAt: favoriteExpiresAt(ttlMode),
      note: options.note,
      scoreAtFavorite: article.score,
    })
    .onConflictDoUpdate({
      target: [favoriteArticles.workspaceId, favoriteArticles.articleId],
      set: {
        ttlMode,
        expiresAt: favoriteExpiresAt(ttlMode),
        note: options.note,
      },
    });

  const [updated] = await db
    .update(articles)
    .set({ isFavorite: true, updatedAt: new Date() })
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
    .returning();

  if (!updated) {
    throw new AppError(404, "Article not found", "ARTICLE_NOT_FOUND");
  }

  return updated;
}

export async function removeFromFavorite(id: string, workspaceId: string) {
  await db
    .delete(favoriteArticles)
    .where(and(eq(favoriteArticles.workspaceId, workspaceId), eq(favoriteArticles.articleId, id)));

  const [updated] = await db
    .update(articles)
    .set({ isFavorite: false, updatedAt: new Date() })
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
    .returning();

  if (!updated) {
    throw new AppError(404, "Article not found", "ARTICLE_NOT_FOUND");
  }

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

export async function deleteArticlesByAgent(workspaceId: string, agentId: string) {
  const deleted = await db
    .delete(articles)
    .where(and(eq(articles.workspaceId, workspaceId), eq(articles.agentId, agentId)))
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
