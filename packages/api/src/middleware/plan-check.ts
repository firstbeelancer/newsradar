import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema.js";
import { AppError } from "./error-handler.js";

// ─── Feature-to-plan mapping ───

const FEATURE_PLANS: Record<string, string[]> = {
  iboard: ["pro", "enterprise"],
  deepsearch: ["pro", "enterprise"],
  asset_packs: ["pro", "enterprise"],
};

export type ProFeature = keyof typeof FEATURE_PLANS;

/**
 * Middleware factory that restricts endpoint access by workspace plan.
 * Returns 403 if the workspace plan does not include the requested feature.
 *
 * @param feature - Feature key to check
 */
export function planCheck(feature: ProFeature) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = (req.query.workspaceId as string) ?? req.body?.workspaceId;
      if (!workspaceId) {
        return next(new AppError(400, "workspaceId required", "VALIDATION_ERROR"));
      }

      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });
      if (!workspace) {
        return next(new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND"));
      }

      const allowedPlans = FEATURE_PLANS[feature] ?? [];
      if (!allowedPlans.includes(workspace.plan)) {
        return next(
          new AppError(403, "Требуется подписка Pro", "PRO_REQUIRED")
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
