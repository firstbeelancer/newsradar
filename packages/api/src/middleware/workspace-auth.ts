import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema.js";
import { AppError } from "./error-handler.js";

/**
 * Middleware that verifies the authenticated user owns the requested workspace.
 * Must be used AFTER authMiddleware (which sets req.user).
 * 
 * Reads workspaceId from:
 *  1. req.query.workspaceId (most common)
 *  2. req.params.workspaceId
 *  3. req.body.workspaceId
 * 
 * On success, sets req.workspaceId and req.workspace.
 */
export async function workspaceAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.sub) {
      return next(new AppError(401, "Not authenticated", "UNAUTHORIZED"));
    }

    const workspaceId =
      (req.query.workspaceId as string) ||
      (req.params.workspaceId as string) ||
      (req.body?.workspaceId as string);

    if (!workspaceId) {
      return next(new AppError(400, "workspaceId is required", "MISSING_WORKSPACE"));
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });

    if (!workspace) {
      return next(new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND"));
    }

    if (workspace.userId !== req.user.sub) {
      return next(new AppError(403, "Access denied: workspace belongs to another user", "FORBIDDEN"));
    }

    // Attach to request for downstream use
    req.workspaceId = workspaceId;
    req.workspace = workspace;
    next();
  } catch (err) {
    next(err);
  }
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      workspaceId?: string;
      workspace?: {
        id: string;
        userId: string;
        name: string;
        plan: string;
        periodEnd: Date | null;
      };
    }
  }
}
