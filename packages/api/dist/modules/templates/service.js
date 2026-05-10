import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentTemplates } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
// ─── CRUD ───
export async function createTemplate(data) {
    // If setting as default, unset other defaults of the same type
    if (data.isDefault) {
        await clearDefaultFlag(data.workspaceId, data.type);
    }
    const [template] = await db.insert(contentTemplates).values(data).returning();
    return template;
}
export async function getTemplateById(id, workspaceId) {
    const template = await db.query.contentTemplates.findFirst({
        where: and(eq(contentTemplates.id, id), eq(contentTemplates.workspaceId, workspaceId)),
    });
    if (!template) {
        throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");
    }
    return template;
}
export async function listTemplates(workspaceId, params) {
    const conditions = [eq(contentTemplates.workspaceId, workspaceId)];
    if (params?.type) {
        conditions.push(eq(contentTemplates.type, params.type));
    }
    return db.query.contentTemplates.findMany({
        where: and(...conditions),
        orderBy: [contentTemplates.type, contentTemplates.name],
    });
}
export async function updateTemplate(id, workspaceId, data) {
    const existing = await getTemplateById(id, workspaceId);
    // If setting as default, clear other defaults
    if (data.isDefault && data.type) {
        await clearDefaultFlag(workspaceId, data.type);
    }
    else if (data.isDefault && !data.type) {
        await clearDefaultFlag(workspaceId, existing.type);
    }
    const [updated] = await db
        .update(contentTemplates)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(contentTemplates.id, id), eq(contentTemplates.workspaceId, workspaceId)))
        .returning();
    return updated;
}
export async function deleteTemplate(id, workspaceId) {
    await getTemplateById(id, workspaceId);
    await db
        .delete(contentTemplates)
        .where(and(eq(contentTemplates.id, id), eq(contentTemplates.workspaceId, workspaceId)));
    return { deleted: true };
}
// ─── Helpers ───
async function clearDefaultFlag(workspaceId, type) {
    await db
        .update(contentTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(contentTemplates.workspaceId, workspaceId), eq(contentTemplates.type, type), eq(contentTemplates.isDefault, true)));
}
//# sourceMappingURL=service.js.map