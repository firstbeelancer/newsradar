export declare function getWorkspaceByUserId(userId: string): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    plan: string;
    periodEnd: Date | null;
}>;
export declare function createWorkspace(userId: string, name: string): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    plan: string;
    periodEnd: Date | null;
}>;
export declare function updateWorkspace(userId: string, name: string): Promise<{
    id: string;
    userId: string;
    name: string;
    plan: string;
    periodEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function updatePlan(userId: string, plan: string): Promise<{
    id: string;
    userId: string;
    name: string;
    plan: string;
    periodEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
}>;
//# sourceMappingURL=service.d.ts.map