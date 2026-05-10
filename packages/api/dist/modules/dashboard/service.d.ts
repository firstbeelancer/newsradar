export declare function getDashboardData(params: {
    userId: string;
    workspaceId: string;
}): Promise<{
    workspace: {
        id: string;
        name: string;
        plan: string;
    };
    agents: {
        id: string;
        name: string;
        description: string | null;
        icon: string;
        color: string;
        position: number;
        article_count: number;
        articleCount: number;
        is_active: boolean;
        isActive: boolean;
    }[];
    favoriteCount: number;
    favorite_count: number;
    favoriteLimit: number;
    favorite_limit: number;
    totalArticles: number;
    total_articles: number;
    lastOperations: {
        id: string;
        agentId: string | null;
        agent_id: string | null;
        operationType: string;
        operation_type: string;
        status: string;
        message: string | null;
        metadata: unknown;
        startedAt: Date;
        started_at: Date;
        finishedAt: Date | null;
        finished_at: Date | null;
        createdAt: Date;
        created_at: Date;
    }[];
}>;
export declare function collectAllAgents(params: {
    userId: string;
    workspaceId: string;
}): Promise<{
    operationId: string;
    op_id: string;
    status: string;
    message: string | null;
    agentCount: number;
    agent_count: number;
}>;
//# sourceMappingURL=service.d.ts.map