import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, workspaces } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";

export async function getWorkspaceByUserId(userId: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.userId, userId),
  });
  if (!workspace) {
    throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  }
  return workspace;
}

export async function createWorkspace(userId: string, name: string) {
  const existing = await db.query.workspaces.findFirst({
    where: eq(workspaces.userId, userId),
  });
  if (existing) {
    throw new AppError(409, "User already has a workspace", "WORKSPACE_EXISTS");
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({ userId, name })
    .returning();

  return workspace;
}

export async function updateWorkspace(userId: string, name?: string, config?: Record<string, unknown>) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.userId, userId),
  });
  if (!workspace) {
    throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (config !== undefined) {
    // Merge config with existing config
    updates.config = { ...(workspace.config as Record<string, unknown> || {}), ...config };
  }

  const [updated] = await db
    .update(workspaces)
    .set(updates)
    .where(eq(workspaces.id, workspace.id))
    .returning();

  return updated;
}

export async function updatePlan(userId: string, plan: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.userId, userId),
  });
  if (!workspace) {
    throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  }

  const [updated] = await db
    .update(workspaces)
    .set({ plan, updatedAt: new Date() })
    .where(eq(workspaces.id, workspace.id))
    .returning();

  return updated;
}
