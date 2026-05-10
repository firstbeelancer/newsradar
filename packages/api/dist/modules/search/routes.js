import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { paginationQuerySchema, encodeCursor, decodeCursor } from "../../lib/pagination.js";
import { db } from "../../db/index.js";
import { generatedPosts } from "../../db/schema.js";
import { searchArticles } from "../articles/service.js";
const router = Router();
function requireSearchParams(query) {
    const workspaceId = query.workspaceId;
    const q = query.q;
    if (!workspaceId)
        throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    if (!q || q.trim().length < 2) {
        throw new AppError(400, "q must be at least 2 characters", "VALIDATION_ERROR");
    }
    return { workspaceId, q: q.trim() };
}
router.get("/articles", authMiddleware, async (req, res, next) => {
    try {
        const { cursor, limit } = paginationQuerySchema.parse(req.query);
        const { workspaceId, q } = requireSearchParams(req.query);
        const result = await searchArticles(workspaceId, q, { limit, cursor: cursor ?? null });
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
});
router.get("/generated", authMiddleware, async (req, res, next) => {
    try {
        const { cursor, limit } = paginationQuerySchema.parse(req.query);
        const { workspaceId, q } = requireSearchParams(req.query);
        const tsQuery = q
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => `${word}:*`)
            .join(" & ");
        const conditions = [
            eq(generatedPosts.workspaceId, workspaceId),
            sql `to_tsvector('russian', COALESCE(${generatedPosts.title}, '') || ' ' || ${generatedPosts.content}) @@ to_tsquery('russian', ${tsQuery})`,
        ];
        if (cursor) {
            const decoded = decodeCursor(cursor);
            if (decoded?.sortValue) {
                conditions.push(sql `${generatedPosts.createdAt} < ${new Date(decoded.sortValue)}`);
            }
        }
        const rows = await db
            .select()
            .from(generatedPosts)
            .where(and(...conditions))
            .orderBy(desc(generatedPosts.createdAt))
            .limit(limit + 1);
        const hasMore = rows.length > limit;
        const data = hasMore ? rows.slice(0, -1) : rows;
        const lastItem = data[data.length - 1];
        const nextCursor = hasMore && lastItem
            ? encodeCursor({ id: lastItem.id, sortValue: lastItem.createdAt.toISOString() })
            : null;
        res.json({ success: true, data: { data, nextCursor, hasMore } });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=routes.js.map