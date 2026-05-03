import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import {
  createTemplate,
  getTemplateById,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from "./service.js";

const router = Router();

// ─── Schemas ───

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["short", "detailed", "digest"]),
  systemPrompt: z.string().min(1),
  userPrompt: z.string().default("{{content}}"),
  variables: z.array(z.object({ name: z.string(), description: z.string().optional() })).default([]),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().min(1).optional(),
  userPrompt: z.string().optional(),
  variables: z.array(z.object({ name: z.string(), description: z.string().optional() })).optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  type: z.enum(["short", "detailed", "digest"]).optional(),
});

// ─── Routes ───

// List templates
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const type = (req.query.type as string) || undefined;
    const templates = await listTemplates(workspaceId, { type });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

// Create template
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = createSchema.parse(req.body);
    const template = await createTemplate({
      ...input,
      workspaceId,
    });
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// Get template
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const template = await getTemplateById(req.params.id, workspaceId);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// Update template
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = updateSchema.parse(req.body);
    const template = await updateTemplate(req.params.id, workspaceId, input);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// Delete template
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await deleteTemplate(req.params.id, workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
