export interface IboardStats {
    totalArticles: number;
    avgScore: number;
    topSources: Array<{
        sourceId: string;
        sourceName: string;
        articleCount: number;
    }>;
    activity7d: Array<{
        date: string;
        count: number;
    }>;
}
export interface TimelineEvent {
    date: Date;
    type: string;
    title: string;
    count?: number;
}
export interface LeaderboardEntry {
    id: string;
    title: string;
    score: number;
    sourceName: string;
    publishedAt: Date | null;
    aiSummary: string | null;
}
export interface SourceHealth {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    fetchStatus: string;
    lastFetchAt: Date | null;
    errorCount: number;
    lastError: string | null;
    articleCount: number;
}
export declare function getIboardStats(workspaceId: string): Promise<IboardStats>;
export declare function getTimeline(workspaceId: string): Promise<TimelineEvent[]>;
export declare function getLeaderboard(workspaceId: string, limit?: number): Promise<LeaderboardEntry[]>;
export declare function getSourcesHealth(workspaceId: string): Promise<SourceHealth[]>;
//# sourceMappingURL=service.d.ts.map