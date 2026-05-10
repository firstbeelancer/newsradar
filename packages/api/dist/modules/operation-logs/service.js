import { eq, desc, and, lt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { operationLogs } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
export async function createOperationLog(data) {
    const [log] = await db.insert(operationLogs).values(data).returning();
    return log;
}
export async function getOperationLogById(id, userId) {
    const log = await db.query.operationLogs.findFirst({
        where: and(eq(operationLogs.id, id), eq(operationLogs.userId, userId)),
    });
    if (!log) {
        throw new AppError(404, "Operation log not found", "LOG_NOT_FOUND");
    }
    return log;
}
export async function listOperationLogs(params) {
    const conditions = [eq(operationLogs.userId, params.userId)];
    if (params.workspaceId) {
        conditions.push(eq(operationLogs.workspaceId, params.workspaceId));
    }
    if (params.agentId) {
        conditions.push(eq(operationLogs.agentId, params.agentId));
    }
    if (params.status) {
        conditions.push(eq(operationLogs.status, params.status));
    }
    if (params.cursor) {
        const decoded = decodeCursor(params.cursor);
        if (decoded?.sortValue) {
            conditions.push(lt(operationLogs.createdAt, new Date(decoded.sortValue)));
        }
    }
    const rows = await db
        .select()
        .from(operationLogs)
        .where(and(...conditions))
        .orderBy(desc(operationLogs.createdAt))
        .limit(params.limit + 1);
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
export async function updateOperationLog(id, userId, data) {
    const existing = await db.query.operationLogs.findFirst({
        where: and(eq(operationLogs.id, id), eq(operationLogs.userId, userId)),
    });
    if (!existing) {
        throw new AppError(404, "Operation log not found", "LOG_NOT_FOUND");
    }
    const [updated] = await db
        .update(operationLogs)
        .set(data)
        .where(eq(operationLogs.id, id))
        .returning();
    return updated;
}
export async function deleteOperationLog(id, userId) {
    const existing = await db.query.operationLogs.findFirst({
        where: and(eq(operationLogs.id, id), eq(operationLogs.userId, userId)),
    });
    if (!existing) {
        throw new AppError(404, "Operation log not found", "LOG_NOT_FOUND");
    }
    await db.delete(operationLogs).where(eq(operationLogs.id, id));
    return { deleted: true };
}
//# sourceMappingURL=service.js.map