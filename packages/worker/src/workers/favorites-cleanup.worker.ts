/**
 * ------------------------------------------------------------------
 * Worker: favorites-cleanup
 * ------------------------------------------------------------------
 * Checks favorites limit per workspace (Free: 100, Pro: 1000).
 * If exceeded, removes oldest favorites by FIFO.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { articles, workspaces, usageCounters } from "../../api/src/db/schema.js";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface FavoritesCleanupJob {
  workspaceId: string;
}

/**
 * Get the favorites limit for a workspace based on its plan.
 */
function getFavoritesLimit(plan: string): number {
  switch (plan.toLowerCase()) {
    case "pro":
      return 1_000;
    case "enterprise":
      return 10_000;
    case "free":
    default:
      return 100;
  }
}

/**
 * Process a favorites-cleanup job.
 */
export async function processFavoritesCleanup(
  job: Job<FavoritesCleanupJob>,
  logger: Logger
): Promise<{ removed: number; total: number; limit: number }> {
  const { workspaceId } = job.data;

  logger.debug({ workspaceId, jobId: job.id }, "Processing favorites cleanup");

  // Load workspace plan
  const workspaceResult = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const workspace = workspaceResult[0];
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const limit = getFavoritesLimit(workspace.plan);

  // Count current favorites
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(and(eq(articles.workspaceId, workspaceId), eq(articles.isFavorite, true)));

  const total = Number(countResult[0]?.count ?? 0);

  if (total <= limit) {
    logger.debug({ workspaceId, total, limit }, "Favorites within limit");
    return { removed: 0, total, limit };
  }

  // Remove oldest favorites (FIFO) to get back under limit
  const overflow = total - limit;

  const toRemove = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.workspaceId, workspaceId), eq(articles.isFavorite, true)))
    .orderBy(asc(articles.updatedAt))
    .limit(overflow);

  const idsToRemove = toRemove.map((r) => r.id);

  if (idsToRemove.length > 0) {
    await db
      .update(articles)
      .set({ isFavorite: false, updatedAt: new Date() })
      .where(sql`${articles.id} = ANY(${idsToRemove})`);
  }

  logger.info(
    { workspaceId, removed: idsToRemove.length, total, limit },
    "Favorites cleaned up"
  );

  return { removed: idsToRemove.length, total: total - idsToRemove.length, limit };
}
