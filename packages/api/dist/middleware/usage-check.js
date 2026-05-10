import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { usageCounters, workspaces } from "../db/schema.js";
import { AppError } from "./error-handler.js";
// ─── Limits per plan ───
const PLAN_LIMITS = {
    free: {
        favorites: 100,
        collections: 30,
        digests: 10,
        deepsearches: 10,
        posts: 10,
    },
    pro: {
        favorites: 1000,
        collections: 300,
        digests: 100,
        deepsearches: 100,
        posts: 100,
    },
};
/**
 * Creates Express middleware that checks usage counters before allowing
 * an operation. Returns 429 if the workspace has exceeded its plan limit.
 *
 * @param counterType - Which usage counter to check
 * @param increment   - Whether to auto-increment on success (default: true)
 */
export function usageCheck(counterType, increment = true) {
    return async (req, _res, next) => {
        try {
            const workspaceId = req.query.workspaceId ?? req.body?.workspaceId;
            if (!workspaceId) {
                return next(new AppError(400, "workspaceId required", "VALIDATION_ERROR"));
            }
            // Resolve workspace plan
            const workspace = await db.query.workspaces.findFirst({
                where: eq(workspaces.id, workspaceId),
            });
            if (!workspace) {
                return next(new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND"));
            }
            const plan = workspace.plan ?? "free";
            const limit = PLAN_LIMITS[plan]?.[counterType] ?? PLAN_LIMITS.free[counterType];
            // Find or create usage counter for current period
            const now = new Date();
            let counter = await db.query.usageCounters.findFirst({
                where: and(eq(usageCounters.workspaceId, workspaceId), eq(usageCounters.type, counterType), sql `${usageCounters.periodStart} <= ${now}`, sql `${usageCounters.periodEnd} >= ${now}`),
            });
            if (!counter) {
                // Create new period counter (monthly period)
                const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 23, 59, 59, 999);
                const [newCounter] = await db
                    .insert(usageCounters)
                    .values({
                    workspaceId,
                    type: counterType,
                    used: 0,
                    limit,
                    periodStart: now,
                    periodEnd,
                })
                    .returning();
                counter = newCounter;
            }
            else if (counter.limit !== limit) {
                // Sync limit if plan changed
                await db
                    .update(usageCounters)
                    .set({ limit })
                    .where(eq(usageCounters.id, counter.id));
                counter.limit = limit;
            }
            if (counter.used >= counter.limit) {
                return next(new AppError(429, `Лимит операций «${counterType}» исчерпан (${counter.used}/${counter.limit}). Обновите подписку для увеличения лимита.`, "USAGE_LIMIT_EXCEEDED"));
            }
            // Attach counter info to request for downstream use
            req.usageCounter = {
                id: counter.id,
                used: counter.used,
                limit: counter.limit,
                type: counterType,
            };
            // Auto-increment if requested
            if (increment) {
                await db
                    .update(usageCounters)
                    .set({ used: sql `${usageCounters.used} + 1`, updatedAt: new Date() })
                    .where(eq(usageCounters.id, counter.id));
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
/**
 * Reads current usage for a workspace without incrementing.
 */
export async function getUsageStatus(workspaceId) {
    const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
    });
    const plan = workspace?.plan ?? "free";
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const counters = await db
        .select()
        .from(usageCounters)
        .where(and(eq(usageCounters.workspaceId, workspaceId), sql `${usageCounters.periodEnd} >= ${new Date()}`));
    const result = {};
    for (const key of Object.keys(limits)) {
        const c = counters.find((x) => x.type === key);
        result[key] = {
            used: c?.used ?? 0,
            limit: c?.limit ?? limits[key],
            periodEnd: c?.periodEnd ?? null,
        };
    }
    return { plan, limits: result };
}
//# sourceMappingURL=usage-check.js.map