import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { subjectAreas } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { SubjectArea } from "../../db/types.js";

// ─── Helpers ───

function rowToSubjectArea(row: typeof subjectAreas.$inferSelect): SubjectArea {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    color: row.color,
    defaultTopic: row.defaultTopic,
    defaultAudience: row.defaultAudience,
    defaultsJson: row.defaultsJson as Record<string, unknown>,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── CRUD ───

export async function listSubjectAreas(workspaceId?: string): Promise<SubjectArea[]> {
  const conditions = workspaceId ? [eq(subjectAreas.id, workspaceId)] : [];
  // Если workspaceId передан — фильтруем, иначе возвращаем все
  // Фактически subject_areas — глобальный справочник, workspaceId здесь не FK
  const rows = workspaceId
    ? await db.query.subjectAreas.findMany({ where: eq(subjectAreas.id, workspaceId) })
    : await db.query.subjectAreas.findMany({ orderBy: subjectAreas.position });

  return rows.map(rowToSubjectArea);
}

export async function getSubjectAreaById(id: string): Promise<SubjectArea> {
  const row = await db.query.subjectAreas.findFirst({
    where: eq(subjectAreas.id, id),
  });
  if (!row) {
    throw new AppError(404, `Subject area "${id}" not found`, "NOT_FOUND");
  }
  return rowToSubjectArea(row);
}

export async function updateSubjectAreaDefaults(
  id: string,
  data: {
    defaultTopic?: string;
    defaultAudience?: string;
    defaultsJson?: Record<string, unknown>;
    icon?: string;
    color?: string;
  }
): Promise<SubjectArea> {
  const existing = await getSubjectAreaById(id);

  const [updated] = await db
    .update(subjectAreas)
    .set({
      ...data,
      defaultsJson: data.defaultsJson ? JSON.stringify(data.defaultsJson) : existing.defaultsJson,
      updatedAt: new Date(),
    })
    .where(eq(subjectAreas.id, id))
    .returning();

  return rowToSubjectArea(updated);
}