import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import {
  createSource,
  getSourceById,
  listSources,
  updateSource,
  deleteSource,
  testSource,
  triggerFetch,
} from "./service.js";

const router = Router();

// ─── Schemas ───

const createSchema = z.object({
  type: z.enum(["rss", "telegram"]),
  name: z.string().min(1).max(200),
  url: z.string().min(1),
  channelUsername: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().min(1).optional(),
  channelUsername: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

const workspaceQuerySchema = z.object({
  workspaceId: z.string().uuid(),
});

// ─── Routes ───

// List sources
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const { workspaceId } = workspaceQuerySchema.parse(req.query);

    const type = (req.query.type as string) || undefined;
    const isActive = req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;

    const result = await listSources(workspaceId, { limit, cursor: cursor ?? null, type, isActive });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Create source
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { workspaceId } = workspaceQuerySchema.parse(req.query);
    const input = createSchema.parse(req.body);

    const source = await createSource({
      ...input,
      workspaceId,
    });
    res.status(201).json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

// Get source details
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const source = await getSourceById(req.params.id, workspaceId);
    res.json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

// Update source
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = updateSchema.parse(req.body);
    const source = await updateSource(req.params.id, workspaceId, input);
    res.json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

// Delete source
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await deleteSource(req.params.id, workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// Test source connectivity
router.post("/:id/test", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await testSource(req.params.id, workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Trigger manual fetch
router.post("/:id/fetch", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await triggerFetch(req.params.id, workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
