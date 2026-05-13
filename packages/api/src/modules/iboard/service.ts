import { eq, and, desc, sql, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, sources, articleScores, agents } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";

// ─── Types ───

export interface IboardStats {
  totalArticles: number;
  avgScore: number;
  topSources: Array<{ sourceId: string; sourceName: string; articleCount: number }>;
  activity7d: Array<{ date: string; count: number }>;
}

export interface TimelineEvent {
  date: Date;
  type: string;
  title: string;
  count?: number;
}

export interface LeaderboardEntry {
  id: string;
  title: string;
  score: number;
  sourceName: string;
  publishedAt: Date | null;
  aiSummary: string | null;
}

export interface SourceHealth {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  fetchStatus: string;
  lastFetchAt: Date | null;
  errorCount: number;
  lastError: string | null;
  articleCount: number;
}

// ─── iBoard Stats ───

export async function getIboardStats(workspaceId: string): Promise<IboardStats> {
  // Total articles
  const articleCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(eq(articles.workspaceId, workspaceId));
  const totalArticles = Number(articleCountResult[0]?.count ?? 0);

  // Average score
  const avgScoreResult = await db
    .select({ avg: sql<number>`COALESCE(avg(${articles.score}), 0)` })
    .from(articles)
    .where(eq(articles.workspaceId, workspaceId));
  const avgScore = Math.round((Number(avgScoreResult[0]?.avg ?? 0)) * 1000) / 1000;

  // Top sources
  const topSourcesRaw = await db
    .select({
      sourceId: articles.sourceId,
      sourceName: sources.name,
      articleCount: sql<number>`count(*)`,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(eq(articles.workspaceId, workspaceId))
    .groupBy(articles.sourceId, sources.name)
    .orderBy(sql`count(*) DESC`)
    .limit(5);

  const topSources = topSourcesRaw.map((s) => ({
    sourceId: s.sourceId,
    sourceName: s.sourceName,
    articleCount: Number(s.articleCount),
  }));

  // Activity last 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);

  const activityRaw = await db
    .select({
      date: sql<string>`DATE(${articles.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(articles)
    .where(
      and(
        eq(articles.workspaceId, workspaceId),
        gte(articles.createdAt, sevenDaysAgo)
      )
    )
    .groupBy(sql`DATE(${articles.createdAt})`)
    .orderBy(sql`DATE(${articles.createdAt})`);

  // Fill missing days
  const dateMap = new Map<string, number>();
  for (const row of activityRaw) {
    dateMap.set(row.date, Number(row.count));
  }

  const activity7d: Array<{ date: string; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    activity7d.push({ date: dateStr, count: dateMap.get(dateStr) ?? 0 });
  }

  return { totalArticles, avgScore, topSources, activity7d };
}

// ─── Timeline ───

export async function getTimeline(workspaceId: string): Promise<TimelineEvent[]> {
  // Recent articles as timeline events
  const recentArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      createdAt: articles.createdAt,
      sourceName: sources.name,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(eq(articles.workspaceId, workspaceId))
    .orderBy(desc(articles.createdAt))
    .limit(50);

  return recentArticles.map((a) => ({
    date: a.createdAt,
    type: `article_${a.status}`,
    title: a.title,
  }));
}

// ─── Leaderboard ───

export async function getLeaderboard(
  workspaceId: string,
  limit: number = 20
): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      score: articles.score,
      sourceName: sources.name,
      publishedAt: articles.publishedAt,
      aiSummary: articles.aiSummary,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(eq(articles.workspaceId, workspaceId))
    .orderBy(desc(articles.score), desc(articles.publishedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    score: Number(r.score),
    sourceName: r.sourceName,
    publishedAt: r.publishedAt,
    aiSummary: r.aiSummary,
  }));
}

// ─── Sources Health ───

export async function getSourcesHealth(workspaceId: string): Promise<SourceHealth[]> {
  const srcList = await db
    .select()
    .from(sources)
    .where(eq(sources.workspaceId, workspaceId));

  // Get article counts per source
  const articleCounts = await db
    .select({
      sourceId: articles.sourceId,
      count: sql<number>`count(*)`,
    })
    .from(articles)
    .where(eq(articles.workspaceId, workspaceId))
    .groupBy(articles.sourceId);

  const countMap = new Map<string, number>();
  for (const ac of articleCounts) {
    countMap.set(ac.sourceId, Number(ac.count));
  }

  return srcList.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    isActive: s.isActive,
    fetchStatus: s.fetchStatus,
    lastFetchAt: s.lastFetchAt,
    errorCount: s.errorCount,
    lastError: s.lastError,
    articleCount: countMap.get(s.id) ?? 0,
  }));
}
