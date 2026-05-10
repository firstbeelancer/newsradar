import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { notifications } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { env } from "../../config/env.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import Redis from "ioredis";
// ─── SSE / pub-sub for live notifications ───
const NOTIF_SSE_CHANNEL = "newsradar:notifications";
let publisher = null;
function getPublisher() {
    if (!publisher) {
        publisher = new Redis(env.REDIS_URL);
    }
    return publisher;
}
// ─── CRUD ───
export async function createNotification(data) {
    const [notif] = await db.insert(notifications).values(data).returning();
    // Publish to Redis for SSE push
    try {
        const pub = getPublisher();
        await pub.publish(NOTIF_SSE_CHANNEL, JSON.stringify({ workspaceId: data.workspaceId, notification: notif }));
    }
    catch {
        // Non-critical: Redis failure should not block notification creation
    }
    return notif;
}
export async function listNotifications(workspaceId, params) {
    const conditions = [eq(notifications.workspaceId, workspaceId)];
    let query = db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(params.limit + 1);
    if (params.cursor) {
        const decoded = decodeCursor(params.cursor);
        if (decoded?.sortValue) {
            query = db
                .select()
                .from(notifications)
                .where(and(...conditions, sql `${notifications.createdAt} < ${new Date(decoded.sortValue)}`))
                .orderBy(desc(notifications.createdAt))
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
export async function markAsRead(id, workspaceId) {
    const notif = await db.query.notifications.findFirst({
        where: and(eq(notifications.id, id), eq(notifications.workspaceId, workspaceId)),
    });
    if (!notif) {
        throw new AppError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    }
    const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id))
        .returning();
    return updated;
}
export async function markAllAsRead(workspaceId) {
    const result = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.isRead, false)));
    return { updated: result.rowCount ?? 0 };
}
export async function deleteNotification(id, workspaceId) {
    const notif = await db.query.notifications.findFirst({
        where: and(eq(notifications.id, id), eq(notifications.workspaceId, workspaceId)),
    });
    if (!notif) {
        throw new AppError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    }
    await db.delete(notifications).where(eq(notifications.id, id));
    return { deleted: true };
}
export async function getUnreadCount(workspaceId) {
    const result = await db
        .select({ count: sql `count(*)` })
        .from(notifications)
        .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.isRead, false)));
    return Number(result[0]?.count ?? 0);
}
// ─── Event-triggered notifications ───
export async function notifyCollectionDone(workspaceId, agentName, articleCount) {
    return createNotification({
        workspaceId,
        type: "collection_done",
        title: `Сбор «${agentName}» завершён`,
        message: `Собрано ${articleCount} новых статей`,
    });
}
export async function notifyGenerationDone(workspaceId, generationType, postId) {
    return createNotification({
        workspaceId,
        type: "generation_done",
        title: "Генерация контента завершена",
        message: `Тип: ${generationType}${postId ? ` (ID: ${postId})` : ""}`,
        metadata: { postId, generationType },
    });
}
export async function notifyError(workspaceId, operation, errorMessage) {
    return createNotification({
        workspaceId,
        type: "error",
        title: `Ошибка: ${operation}`,
        message: errorMessage,
        metadata: { operation },
    });
}
export async function notifyLimit80(workspaceId, counterType, used, limit) {
    return createNotification({
        workspaceId,
        type: "limit_80",
        title: `Лимит ${counterType} на 80%`,
        message: `Использовано ${used} из ${limit} (${Math.round((used / limit) * 100)}%). Рассмотрите обновление подписки.`,
        metadata: { counterType, used, limit },
    });
}
export async function notifySubscriptionExpiring(workspaceId, daysLeft) {
    return createNotification({
        workspaceId,
        type: "subscription_expiring",
        title: "Подписка истекает скоро",
        message: `До окончания подписки Pro осталось ${daysLeft} дн. Обновите подписку, чтобы сохранить доступ к Pro-функциям.`,
        metadata: { daysLeft },
    });
}
// ─── SSE subscription ───
const clients = new Map();
export async function subscribeToNotifications(workspaceId, res) {
    const list = clients.get(workspaceId) ?? [];
    list.push(res);
    clients.set(workspaceId, list);
    // Send initial unread count
    const unread = await getUnreadCount(workspaceId);
    res.write(`data: ${JSON.stringify({ type: "unread_count", count: unread })}

`);
}
export function unsubscribeFromNotifications(workspaceId, res) {
    const list = clients.get(workspaceId) ?? [];
    const filtered = list.filter((c) => c !== res);
    if (filtered.length === 0) {
        clients.delete(workspaceId);
    }
    else {
        clients.set(workspaceId, filtered);
    }
}
export function getActiveNotificationClients() {
    let count = 0;
    for (const list of clients.values()) {
        count += list.length;
    }
    return count;
}
//# sourceMappingURL=service.js.map