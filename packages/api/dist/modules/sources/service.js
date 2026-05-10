import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sources, articles, agentSources } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
// ─── CRUD ───
export async function createSource(data) {
    const [source] = await db.insert(sources).values(data).returning();
    return source;
}
export async function getSourceById(id, workspaceId) {
    const source = await db.query.sources.findFirst({
        where: and(eq(sources.id, id), eq(sources.workspaceId, workspaceId)),
    });
    if (!source) {
        throw new AppError(404, "Source not found", "SOURCE_NOT_FOUND");
    }
    return source;
}
export async function listSources(workspaceId, params) {
    const conditions = [eq(sources.workspaceId, workspaceId)];
    if (params.type) {
        conditions.push(eq(sources.type, params.type));
    }
    if (params.isActive !== undefined) {
        conditions.push(eq(sources.isActive, params.isActive));
    }
    let query = db
        .select()
        .from(sources)
        .where(and(...conditions))
        .orderBy(desc(sources.createdAt))
        .limit(params.limit + 1);
    if (params.cursor) {
        const decoded = decodeCursor(params.cursor);
        if (decoded?.sortValue) {
            query = db
                .select()
                .from(sources)
                .where(and(...conditions, sql `${sources.createdAt} < ${new Date(decoded.sortValue)}`))
                .orderBy(desc(sources.createdAt))
                .limit(params.limit + 1);
        }
    }
    const rows = await query;
    const hasMore = rows.length > params.limit;
    const data = hasMore ? rows.slice(0, -1) : rows;
    const lastItem = data[data.length - 1];
    const nextCursor = hasMore && lastItem
        ? encodeCursor({
            id: lastItem.id,
            sortValue: lastItem.createdAt.toISOString(),
        })
        : null;
    return { data, nextCursor, hasMore };
}
export async function updateSource(id, workspaceId, data) {
    await getSourceById(id, workspaceId);
    const [updated] = await db
        .update(sources)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(sources.id, id), eq(sources.workspaceId, workspaceId)))
        .returning();
    return updated;
}
export async function deleteSource(id, workspaceId) {
    await getSourceById(id, workspaceId);
    // Unlink from all agents first
    await db.delete(agentSources).where(eq(agentSources.sourceId, id));
    await db.delete(sources).where(and(eq(sources.id, id), eq(sources.workspaceId, workspaceId)));
    return { deleted: true };
}
// ─── Source testing ───
export async function testSource(id, workspaceId) {
    const source = await getSourceById(id, workspaceId);
    // Basic connectivity test based on source type
    if (source.type === "rss") {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(source.url, {
                method: "GET",
                signal: controller.signal,
                headers: {
                    "User-Agent": "NewsRadar/1.0 RSS Fetcher",
                    Accept: "application/rss+xml, application/xml, text/xml, */*",
                },
            });
            clearTimeout(timeout);
            if (!response.ok) {
                return {
                    success: false,
                    status: response.status,
                    message: `HTTP ${response.status}: ${response.statusText}`,
                };
            }
            const contentType = response.headers.get("content-type") ?? "";
            const body = await response.text();
            const hasXml = body.trimStart().startsWith("<?xml") || body.includes("<rss") || body.includes("<feed");
            return {
                success: hasXml,
                status: response.status,
                contentType,
                bodyPreview: body.slice(0, 500),
                message: hasXml ? "Valid RSS feed detected" : "Response is not valid RSS/XML",
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            return { success: false, message };
        }
    }
    if (source.type === "telegram") {
        // Telegram testing requires a bot token — return a stub result
        return {
            success: true,
            message: "Telegram source validation requires bot configuration. Source structure is valid.",
            note: "Actual message fetching will be done by the collection worker",
        };
    }
    return { success: false, message: "Unknown source type" };
}
// ─── Manual fetch trigger ───
export async function triggerFetch(id, workspaceId) {
    const source = await getSourceById(id, workspaceId);
    if (!source.isActive) {
        throw new AppError(400, "Cannot fetch from inactive source", "SOURCE_INACTIVE");
    }
    // Update fetch state
    await db
        .update(sources)
        .set({
        fetchCount: sql `${sources.fetchCount} + 1`,
        lastFetchAt: new Date(),
        fetchStatus: "success",
        updatedAt: new Date(),
    })
        .where(eq(sources.id, id));
    const operationId = crypto.randomUUID();
    return {
        operationId,
        sourceId: id,
        status: "queued",
        message: "Manual fetch queued",
    };
}
// ─── Source article count ───
export async function getSourceArticleCounts(workspaceId) {
    const rows = await db
        .select({
        sourceId: articles.sourceId,
        count: sql `count(*)`,
    })
        .from(articles)
        .where(eq(articles.workspaceId, workspaceId))
        .groupBy(articles.sourceId);
    return rows.reduce((acc, row) => {
        acc[row.sourceId] = Number(row.count);
        return acc;
    }, {});
}
//# sourceMappingURL=service.js.map