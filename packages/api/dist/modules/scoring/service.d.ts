export interface ScoringWeights {
    aiRelevance: number;
    keywordMatch: number;
    freshness: number;
    sourceTrust: number;
}
export declare const DEFAULT_WEIGHTS: ScoringWeights;
export declare function getScoringConfig(workspaceId: string): Promise<ScoringWeights & {
    workspaceId: string;
}>;
export declare function updateScoringConfig(workspaceId: string, weights: Partial<ScoringWeights>): Promise<ScoringWeights & {
    workspaceId: string;
}>;
export declare function recalculateScores(workspaceId: string, params: {
    agentId?: string;
    articleId?: string;
}): Promise<{
    recalculated: number;
    weights: ScoringWeights & {
        workspaceId: string;
    };
    triggeredAt: string;
}>;
export declare function getScoringStats(workspaceId: string): Promise<{
    totalArticles: number;
    averageScore: number;
    distribution: Record<string, number>;
}>;
//# sourceMappingURL=service.d.ts.map