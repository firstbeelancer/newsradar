import type { Response } from "express";
import type { PaginatedResult } from "../../lib/pagination.js";
import type { NewNotification, Notification } from "../../db/types.js";
export declare function createNotification(data: NewNotification): Promise<Notification>;
export declare function listNotifications(workspaceId: string, params: {
    limit: number;
    cursor?: string | null;
}): Promise<PaginatedResult<Notification>>;
export declare function markAsRead(id: string, workspaceId: string): Promise<Notification>;
export declare function markAllAsRead(workspaceId: string): Promise<{
    updated: number;
}>;
export declare function deleteNotification(id: string, workspaceId: string): Promise<{
    deleted: boolean;
}>;
export declare function getUnreadCount(workspaceId: string): Promise<number>;
export declare function notifyCollectionDone(workspaceId: string, agentName: string, articleCount: number): Promise<{
    message: string;
    type: string;
    id: string;
    createdAt: Date;
    workspaceId: string;
    metadata: unknown;
    title: string;
    isRead: boolean;
}>;
export declare function notifyGenerationDone(workspaceId: string, generationType: string, postId?: string): Promise<{
    message: string;
    type: string;
    id: string;
    createdAt: Date;
    workspaceId: string;
    metadata: unknown;
    title: string;
    isRead: boolean;
}>;
export declare function notifyError(workspaceId: string, operation: string, errorMessage: string): Promise<{
    message: string;
    type: string;
    id: string;
    createdAt: Date;
    workspaceId: string;
    metadata: unknown;
    title: string;
    isRead: boolean;
}>;
export declare function notifyLimit80(workspaceId: string, counterType: string, used: number, limit: number): Promise<{
    message: string;
    type: string;
    id: string;
    createdAt: Date;
    workspaceId: string;
    metadata: unknown;
    title: string;
    isRead: boolean;
}>;
export declare function notifySubscriptionExpiring(workspaceId: string, daysLeft: number): Promise<{
    message: string;
    type: string;
    id: string;
    createdAt: Date;
    workspaceId: string;
    metadata: unknown;
    title: string;
    isRead: boolean;
}>;
export declare function subscribeToNotifications(workspaceId: string, res: Response): Promise<void>;
export declare function unsubscribeFromNotifications(workspaceId: string, res: Response): void;
export declare function getActiveNotificationClients(): number;
//# sourceMappingURL=service.d.ts.map