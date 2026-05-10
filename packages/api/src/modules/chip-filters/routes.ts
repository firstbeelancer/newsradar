import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { workspaceAuth } from "../../middleware/workspace-auth.js";
import {
  listChipFilters,
  createChipFilter,
  updateChipFilter,
  deleteChipFilter,
  reorderChipFilters,
} from "./service.js";

const router = Router();

// ─── Schemas ───

const createChipSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  description: z.string().optional(),
  pattern: z.string().optional(),
  operator: z.enum(["contains", "not_contains", "equals", "starts_with", "regex", "in", "gt", "lt", "gte", "lte"]).default("contains"),
  scoreModifier: z.number().min(-1).max(1).default(0),
  color: z.string().max(20).default("default"),
  icon: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

const updateChipSchema = z.object({
  key: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  pattern: z.string().optional().nullable(),
  operator: z.enum(["contains", "not_contains", "equals", "starts_with", "regex", "in", "gt", "lt", "gte", "lte"]).optional(),
  scoreModifier: z.number().min(-1).max(1).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

// ─── Routes ───

// List chip filters for an agent
router.get("/agents/:agentId", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const filters = await listChipFilters(req.params.agentId, workspaceId);
    res.json({ success: true, data: filters });
  } catch (err) {
    next(err);
  }
});

// Create a chip filter
router.post("/agents/:agentId", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const input = createChipSchema.parse(req.body);
    const filter = await createChipFilter(req.params.agentId, workspaceId, input);
    res.status(201).json({ success: true, data: filter });
  } catch (err) {
    next(err);
  }
});

// Update a chip filter
router.patch("/:filterId", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const input = updateChipSchema.parse(req.body);
    const filter = await updateChipFilter(req.params.filterId, input);
    res.json({ success: true, data: filter });
  } catch (err) {
    next(err);
  }
});

// Delete a chip filter
router.delete("/:filterId", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    await deleteChipFilter(req.params.filterId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// Reorder chip filters
router.post("/agents/:agentId/reorder", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const input = reorderSchema.parse(req.body);
    const filters = await reorderChipFilters(req.params.agentId, input.orderedIds);
    res.json({ success: true, data: filters });
  } catch (err) {
    next(err);
  }
});

export default router;
