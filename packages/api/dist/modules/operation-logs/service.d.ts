import type { NewOperationLog } from "../../db/types.js";
import type { PaginatedResult } from "../../lib/pagination.js";
import type { OperationLog } from "../../db/types.js";
export declare function createOperationLog(data: NewOperationLog): Promise<{
    message: string | null;
    status: string;
    id: string;
    createdAt: Date;
    userId: string;
    workspaceId: string;
    agentId: string | null;
    operationType: string;
    entityType: string | null;
    entityId: string | null;
    metadata: unknown;
    startedAt: Date;
    finishedAt: Date | null;
}>;
export declare function getOperationLogById(id: string, userId: string): Promise<{
    message: string | null;
    status: string;
    id: string;
    createdAt: Date;
    userId: string;
    workspaceId: string;
    agentId: string | null;
    operationType: string;
    entityType: string | null;
    entityId: string | null;
    metadata: unknown;
    startedAt: Date;
    finishedAt: Date | null;
}>;
export declare function listOperationLogs(params: {
    userId: string;
    workspaceId?: string;
    agentId?: string;
    status?: string;
    limit: number;
    cursor?: string | null;
}): Promise<PaginatedResult<OperationLog>>;
export declare function updateOperationLog(id: string, userId: string, data: {
    status?: string;
    message?: string;
    finishedAt?: Date;
    metadata?: Record<string, unknown>;
}): Promise<{
    id: string;
    userId: string;
    workspaceId: string;
    agentId: string | null;
    operationType: string;
    entityType: string | null;
    entityId: string | null;
    status: string;
    message: string | null;
    metadata: unknown;
    startedAt: Date;
    finishedAt: Date | null;
    createdAt: Date;
}>;
export declare function deleteOperationLog(id: string, userId: string): Promise<{
    deleted: boolean;
}>;
//# sourceMappingURL=service.d.ts.map