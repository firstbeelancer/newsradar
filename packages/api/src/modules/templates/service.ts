import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentTemplates } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { ContentTemplate, NewContentTemplate } from "../../db/types.js";

// ─── CRUD ───

export async function createTemplate(data: NewContentTemplate) {
  // If setting as default, unset other defaults of the same type
  if (data.isDefault) {
    await clearDefaultFlag(data.workspaceId, data.type);
  }

  const [template] = await db.insert(contentTemplates).values(data).returning();
  return template;
}

export async function getTemplateById(id: string, workspaceId: string) {
  const template = await db.query.contentTemplates.findFirst({
    where: and(eq(contentTemplates.id, id), eq(contentTemplates.workspaceId, workspaceId)),
  });
  if (!template) {
    throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");
  }
  return template;
}

export async function listTemplates(
  workspaceId: string,
  params?: { type?: string }
): Promise<ContentTemplate[]> {
  const conditions = [eq(contentTemplates.workspaceId, workspaceId)];
  if (params?.type) {
    conditions.push(eq(contentTemplates.type, params.type));
  }

  return db.query.contentTemplates.findMany({
    where: and(...conditions),
    orderBy: [contentTemplates.type, contentTemplates.name],
  });
}

export async function updateTemplate(
  id: string,
  workspaceId: string,
  data: Partial<Pick<ContentTemplate, "name" | "systemPrompt" | "userPrompt" | "variables" | "description" | "isDefault" | "type">>
) {
  const existing = await getTemplateById(id, workspaceId);

  // If setting as default, clear other defaults
  if (data.isDefault && data.type) {
    await clearDefaultFlag(workspaceId, data.type);
  } else if (data.isDefault && !data.type) {
    await clearDefaultFlag(workspaceId, existing.type);
  }

  const [updated] = await db
    .update(contentTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(contentTemplates.id, id), eq(contentTemplates.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function deleteTemplate(id: string, workspaceId: string) {
  await getTemplateById(id, workspaceId);
  await db
    .delete(contentTemplates)
    .where(and(eq(contentTemplates.id, id), eq(contentTemplates.workspaceId, workspaceId)));
  return { deleted: true };
}

// ─── Helpers ───

async function clearDefaultFlag(workspaceId: string, type: string) {
  await db
    .update(contentTemplates)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(
        eq(contentTemplates.workspaceId, workspaceId),
        eq(contentTemplates.type, type),
        eq(contentTemplates.isDefault, true)
      )
    );
}
