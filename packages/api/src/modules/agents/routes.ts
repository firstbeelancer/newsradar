import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { workspaceAuth } from "../../middleware/workspace-auth.js";
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

const scoringWeightSchema = z.object({
  aiRelevance: z.number().min(0).max(1).optional(),
  keywordMatch: z.number().min(0).max(1).optional(),
  freshness: z.number().min(0).max(1).optional(),
  sourceTrust: z.number().min(0).max(1).optional(),
});

const chipFilterSchema = z.object({
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

const agentConfigSchema = z.object({
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  scoringWeights: scoringWeightSchema.optional(),
  chipFilters: z.array(chipFilterSchema).optional(),
  fetchSchedule: z.string().optional(),
  assetPackId: z.string().uuid().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
  position: z.coerce.number().int().optional(),
  subjectArea: z.string().max(50).optional(),
  config: agentConfigSchema.optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
  position: z.coerce.number().int().optional(),
  subjectArea: z.string().max(50).optional(),
  config: agentConfigSchema.optional(),
});

const workspaceQuerySchema = z.object({
  workspaceId: z.string().uuid(),
});

// ─── Routes (all protected with workspaceAuth) ───

// List agents
router.get("/", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const workspaceId = req.workspaceId!;

    const result = await listAgents(workspaceId, { limit, cursor: cursor ?? null });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Create agent
router.post("/", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const input = createSchema.parse(req.body);

    const agent = await createAgent({
      name: input.name,
      description: input.description,
      icon: input.icon ?? "rss",
      color: input.color ?? "#3b82f6",
      position: input.position ?? 0,
      workspaceId,
      subjectArea: input.subjectArea,
      config: input.config ?? {},
    });
    res.status(201).json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// Get agent details (with scoring criteria and chip filters)
router.get("/:id", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const agent = await getAgentById(req.params.id, workspaceId);
    res.json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// Update agent
router.put("/:id", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const input = updateSchema.parse(req.body);
    const agent = await updateAgent(req.params.id, workspaceId, input);
    res.json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// Delete agent
router.delete("/:id", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    await deleteAgent(req.params.id, workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// Get agent stats
router.get("/:id/stats", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const stats = await getAgentStats(req.params.id, workspaceId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// Trigger collection
router.post("/:id/collect", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
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
router.get("/:id/sources", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const sources = await getAgentSources(req.params.id, workspaceId);
    res.json({ success: true, data: sources });
  } catch (err) {
    next(err);
  }
});

// Link a source
router.post("/:id/sources", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const { sourceId } = linkSourceSchema.parse(req.body);
    const result = await linkSource(req.params.id, sourceId, workspaceId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Unlink a source
router.delete("/:id/sources/:sourceId", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    await unlinkSource(req.params.id, req.params.sourceId, workspaceId);
    res.json({ success: true, data: { unlinked: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
