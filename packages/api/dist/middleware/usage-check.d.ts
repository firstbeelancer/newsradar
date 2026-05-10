import type { Request, Response, NextFunction } from "express";
export type UsageCounterType = "favorites" | "collections" | "digests" | "deepsearches" | "posts";
/**
 * Creates Express middleware that checks usage counters before allowing
 * an operation. Returns 429 if the workspace has exceeded its plan limit.
 *
 * @param counterType - Which usage counter to check
 * @param increment   - Whether to auto-increment on success (default: true)
 */
export declare function usageCheck(counterType: UsageCounterType, increment?: boolean): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
/**
 * Reads current usage for a workspace without incrementing.
 */
export declare function getUsageStatus(workspaceId: string): Promise<{
    plan: string;
    limits: Record<string, {
        used: number;
        limit: number;
        periodEnd: Date | null;
    }>;
}>;
//# sourceMappingURL=usage-check.d.ts.map