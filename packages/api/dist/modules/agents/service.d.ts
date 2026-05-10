import type { PaginatedResult } from "../../lib/pagination.js";
import type { Agent, NewAgent } from "../../db/types.js";
export declare function createAgent(data: NewAgent): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    icon: string;
    color: string;
    position: number;
    description: string | null;
    subjectArea: string | null;
    config: unknown;
}>;
export declare function getAgentById(id: string, workspaceId: string): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    icon: string;
    color: string;
    position: number;
    description: string | null;
    subjectArea: string | null;
    config: unknown;
}>;
export declare function listAgents(workspaceId: string, params: {
    limit: number;
    cursor?: string | null;
}): Promise<PaginatedResult<Agent>>;
export declare function updateAgent(id: string, workspaceId: string, data: Partial<Pick<Agent, "name" | "description" | "icon" | "color" | "subjectArea" | "position">>): Promise<{
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    workspaceId: string;
    subjectArea: string | null;
    config: unknown;
    position: number;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deleteAgent(id: string, workspaceId: string): Promise<{
    deleted: boolean;
}>;
export declare function getAgentStats(id: string, workspaceId: string): Promise<{
    sourceCount: number;
    articleCount: number;
    todayCount: number;
    statusBreakdown: Record<string, number>;
}>;
export declare function linkSource(agentId: string, sourceId: string, workspaceId: string): Promise<{
    id: string;
    agentId: string;
    sourceId: string;
}>;
export declare function unlinkSource(agentId: string, sourceId: string, workspaceId: string): Promise<{
    unlinked: boolean;
}>;
export declare function getAgentSources(agentId: string, workspaceId: string): Promise<{
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
}[]>;
export declare function triggerCollection(agentId: string, workspaceId: string, userId: string): Promise<{
    operationId: string;
    op_id: string;
    status: string;
    message: string | null;
    sourceCount: number;
    activeSourceCount: number;
}>;
//# sourceMappingURL=service.d.ts.map