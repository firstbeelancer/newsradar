import { eq, and, desc, sql, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, sources } from "../../db/schema.js";
// ─── iBoard Stats ───
export async function getIboardStats(workspaceId) {
    // Total articles
    const articleCountResult = await db
        .select({ count: sql `count(*)` })
        .from(articles)
        .where(eq(articles.workspaceId, workspaceId));
    const totalArticles = Number(articleCountResult[0]?.count ?? 0);
    // Average score
    const avgScoreResult = await db
        .select({ avg: sql `COALESCE(avg(${articles.score}), 0)` })
        .from(articles)
        .where(eq(articles.workspaceId, workspaceId));
    const avgScore = Math.round((Number(avgScoreResult[0]?.avg ?? 0)) * 1000) / 1000;
    // Top sources
    const topSourcesRaw = await db
        .select({
        sourceId: articles.sourceId,
        sourceName: sources.name,
        articleCount: sql `count(*)`,
    })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(eq(articles.workspaceId, workspaceId))
        .groupBy(articles.sourceId, sources.name)
        .orderBy(sql `count(*) DESC`)
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
        date: sql `DATE(${articles.createdAt})`,
        count: sql `count(*)`,
    })
        .from(articles)
        .where(and(eq(articles.workspaceId, workspaceId), gte(articles.createdAt, sevenDaysAgo)))
        .groupBy(sql `DATE(${articles.createdAt})`)
        .orderBy(sql `DATE(${articles.createdAt})`);
    // Fill missing days
    const dateMap = new Map();
    for (const row of activityRaw) {
        dateMap.set(row.date, Number(row.count));
    }
    const activity7d = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        activity7d.push({ date: dateStr, count: dateMap.get(dateStr) ?? 0 });
    }
    return { totalArticles, avgScore, topSources, activity7d };
}
// ─── Timeline ───
export async function getTimeline(workspaceId) {
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
export async function getLeaderboard(workspaceId, limit = 20) {
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
export async function getSourcesHealth(workspaceId) {
    const srcList = await db
        .select()
        .from(sources)
        .where(eq(sources.workspaceId, workspaceId));
    // Get article counts per source
    const articleCounts = await db
        .select({
        sourceId: articles.sourceId,
        count: sql `count(*)`,
    })
        .from(articles)
        .where(eq(articles.workspaceId, workspaceId))
        .groupBy(articles.sourceId);
    const countMap = new Map();
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
//# sourceMappingURL=service.js.map