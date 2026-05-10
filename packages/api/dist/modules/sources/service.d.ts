import type { PaginatedResult } from "../../lib/pagination.js";
import type { Source, NewSource } from "../../db/types.js";
export declare function createSource(data: NewSource): Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    url: string;
    channelUsername: string | null;
    isActive: boolean;
    fetchSchedule: string | null;
    fetchCount: number;
    lastFetchAt: Date | null;
    lastError: string | null;
    errorCount: number;
    fetchStatus: string;
    health: unknown;
}>;
export declare function getSourceById(id: string, workspaceId: string): Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    url: string;
    channelUsername: string | null;
    isActive: boolean;
    fetchSchedule: string | null;
    fetchCount: number;
    lastFetchAt: Date | null;
    lastError: string | null;
    errorCount: number;
    fetchStatus: string;
    health: unknown;
}>;
export declare function listSources(workspaceId: string, params: {
    limit: number;
    cursor?: string | null;
    type?: string;
    isActive?: boolean;
}): Promise<PaginatedResult<Source>>;
export declare function updateSource(id: string, workspaceId: string, data: Partial<Pick<Source, "name" | "url" | "channelUsername" | "isActive">>): Promise<{
    id: string;
    type: string;
    name: string;
    url: string;
    channelUsername: string | null;
    isActive: boolean;
    workspaceId: string;
    fetchSchedule: string | null;
    fetchCount: number;
    lastFetchAt: Date | null;
    lastError: string | null;
    errorCount: number;
    fetchStatus: string;
    health: unknown;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deleteSource(id: string, workspaceId: string): Promise<{
    deleted: boolean;
}>;
export declare function testSource(id: string, workspaceId: string): Promise<{
    success: boolean;
    status: number;
    message: string;
    contentType?: undefined;
    bodyPreview?: undefined;
    note?: undefined;
} | {
    success: boolean;
    status: number;
    contentType: string;
    bodyPreview: string;
    message: string;
    note?: undefined;
} | {
    success: boolean;
    message: string;
    status?: undefined;
    contentType?: undefined;
    bodyPreview?: undefined;
    note?: undefined;
} | {
    success: boolean;
    message: string;
    note: string;
    status?: undefined;
    contentType?: undefined;
    bodyPreview?: undefined;
}>;
export declare function triggerFetch(id: string, workspaceId: string): Promise<{
    operationId: `${string}-${string}-${string}-${string}-${string}`;
    sourceId: string;
    status: string;
    message: string;
}>;
export declare function getSourceArticleCounts(workspaceId: string): Promise<Record<string, number>>;
//# sourceMappingURL=service.d.ts.map