import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import {
  createAgent,
  getAgentById,
  listAgents,
  updateAgent,
  deleteAgent,
  getAgentStats,
  triggerCollection,
  linkSource,
  unlinkSource,
  getAgentSources,
} from "./service.js";

const router = Router();

// ─── Schemas ───

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
  position: z.coerce.number().int().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
  position: z.coerce.number().int().optional(),
});

const workspaceQuerySchema = z.object({
  workspaceId: z.string().uuid(),
});

// ─── Routes ───

// List agents
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const { workspaceId } = workspaceQuerySchema.parse(req.query);

    const result = await listAgents(workspaceId, { limit, cursor: cursor ?? null });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Create agent
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { workspaceId } = workspaceQuerySchema.parse(req.query);
    const input = createSchema.parse(req.body);

    const agent = await createAgent({
      ...input,
      workspaceId,
    });
    res.status(201).json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// Get agent details
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const agent = await getAgentById(req.params.id, workspaceId);
    res.json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// Update agent
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = updateSchema.parse(req.body);
    const agent = await updateAgent(req.params.id, workspaceId, input);
    res.json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// Delete agent
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await deleteAgent(req.params.id, workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// Get agent stats
router.get("/:id/stats", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const stats = await getAgentStats(req.params.id, workspaceId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// Trigger collection
router.post("/:id/collect", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await triggerCollection(req.params.id, workspaceId, req.user!.sub);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Agent ↔ Source linking ───

const linkSourceSchema = z.object({
  sourceId: z.string().uuid(),
});

// List linked sources
router.get("/:id/sources", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const sources = await getAgentSources(req.params.id, workspaceId);
    res.json({ success: true, data: sources });
  } catch (err) {
    next(err);
  }
});

// Link a source
router.post("/:id/sources", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const { sourceId } = linkSourceSchema.parse(req.body);
    const result = await linkSource(req.params.id, sourceId, workspaceId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Unlink a source
router.delete("/:id/sources/:sourceId", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await unlinkSource(req.params.id, req.params.sourceId, workspaceId);
    res.json({ success: true, data: { unlinked: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
