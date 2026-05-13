import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, chipFilters } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";

// ─── CRUD ───

async function verifyAgentOwnership(agentId: string, workspaceId: string) {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)),
  });
  if (!agent) {
    throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
  }
  return agent;
}

export async function listChipFilters(agentId: string, workspaceId: string) {
  await verifyAgentOwnership(agentId, workspaceId);

  return db
    .select()
    .from(chipFilters)
    .where(eq(chipFilters.agentId, agentId))
    .orderBy(chipFilters.position);
}

export async function createChipFilter(
  agentId: string,
  workspaceId: string,
  data: {
    key: string;
    label: string;
    description?: string;
    pattern?: string;
    operator: string;
    scoreModifier: number;
    color: string;
    icon?: string;
    isActive: boolean;
  }
) {
  await verifyAgentOwnership(agentId, workspaceId);

  // Get next position
  const existing = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${chipFilters.position}), -1)` })
    .from(chipFilters)
    .where(eq(chipFilters.agentId, agentId));

  const nextPos = (existing[0]?.maxPos ?? -1) + 1;

  const [filter] = await db
    .insert(chipFilters)
    .values({
      agentId,
      key: data.key,
      label: data.label,
      description: data.description ?? null,
      pattern: data.pattern ?? null,
      operator: data.operator,
      scoreModifier: data.scoreModifier.toFixed(4),
      color: data.color,
      icon: data.icon ?? null,
      isActive: data.isActive,
      position: nextPos,
    })
    .returning();

  return filter;
}

export async function updateChipFilter(
  filterId: string,
  data: {
    key?: string;
    label?: string;
    description?: string | null;
    pattern?: string | null;
    operator?: string;
    scoreModifier?: number;
    color?: string;
    icon?: string | null;
    isActive?: boolean;
  }
) {
  const existing = await db.query.chipFilters.findFirst({
    where: eq(chipFilters.id, filterId),
  });
  if (!existing) {
    throw new AppError(404, "Chip filter not found", "CHIP_FILTER_NOT_FOUND");
  }

  const [updated] = await db
    .update(chipFilters)
    .set({
      ...(data.key !== undefined && { key: data.key }),
      ...(data.label !== undefined && { label: data.label }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.pattern !== undefined && { pattern: data.pattern }),
      ...(data.operator !== undefined && { operator: data.operator }),
      ...(data.scoreModifier !== undefined && { scoreModifier: data.scoreModifier.toFixed(4) }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(chipFilters.id, filterId))
    .returning();

  return updated;
}

export async function deleteChipFilter(filterId: string) {
  const existing = await db.query.chipFilters.findFirst({
    where: eq(chipFilters.id, filterId),
  });
  if (!existing) {
    throw new AppError(404, "Chip filter not found", "CHIP_FILTER_NOT_FOUND");
  }

  await db.delete(chipFilters).where(eq(chipFilters.id, filterId));
  return { deleted: true };
}

export async function reorderChipFilters(agentId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(chipFilters)
      .set({ position: i, updatedAt: new Date() })
      .where(
        and(
          eq(chipFilters.id, orderedIds[i]),
          eq(chipFilters.agentId, agentId)
        )
      );
  }

  return db
    .select()
    .from(chipFilters)
    .where(eq(chipFilters.agentId, agentId))
    .orderBy(chipFilters.position);
}
