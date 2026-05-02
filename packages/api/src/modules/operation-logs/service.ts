import { eq, desc, and, isNotNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { operationLogs } from "../../db/schema.js";
import type { NewOperationLog } from "../../db/types.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { OperationLog } from "../../db/types.js";

export async function createOperationLog(data: NewOperationLog) {
  const [log] = await db.insert(operationLogs).values(data).returning();
  return log;
}

export async function getOperationLogById(id: string, userId: string) {
  const log = await db.query.operationLogs.findFirst({
    where: and(eq(operationLogs.id, id), eq(operationLogs.userId, userId)),
  });
  if (!log) {
    throw new AppError(404, "Operation log not found", "LOG_NOT_FOUND");
  }
  return log;
}

export async function listOperationLogs(
  params: {
    userId: string;
    workspaceId?: string;
    agentId?: string;
    status?: string;
    limit: number;
    cursor?: string | null;
  }
): Promise<PaginatedResult<OperationLog>> {
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

  let query = db
    .select()
    .from(operationLogs)
    .where(and(...conditions))
    .orderBy(desc(operationLogs.createdAt))
    .limit(params.limit + 1);

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      query = query.where(
        and(
          ...conditions,
          operationLogs.createdAt < new Date(decoded.sortValue)
        )
      );
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
          sortValue: lastItem.createdAt.toISOString(),
        } as Cursor)
      : null;

  return { data, nextCursor, hasMore };
}

export async function updateOperationLog(
  id: string,
  userId: string,
  data: { status?: string; message?: string; finishedAt?: Date; metadata?: Record<string, unknown> }
) {
  const existing = await db.query.operationLogs.findFirst({
    where: and(eq(operationLogs.id, id), eq(operationLogs.userId, userId)),
  });
  if (!existing) {
    throw new AppError(404, "Operation log not found", "LOG_NOT_FOUND");
  }

  const [updated] = await db
    .update(operationLogs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(operationLogs.id, id))
    .returning();

  return updated;
}

export async function deleteOperationLog(id: string, userId: string) {
  const existing = await db.query.operationLogs.findFirst({
    where: and(eq(operationLogs.id, id), eq(operationLogs.userId, userId)),
  });
  if (!existing) {
    throw new AppError(404, "Operation log not found", "LOG_NOT_FOUND");
  }

  await db.delete(operationLogs).where(eq(operationLogs.id, id));
  return { deleted: true };
}
