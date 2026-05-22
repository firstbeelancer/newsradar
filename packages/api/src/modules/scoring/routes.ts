import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { workspaceAuth } from "../../middleware/workspace-auth.js";
import { AppError } from "../../middleware/error-handler.js";
import {
  getAgentScoringCriteria,
  updateScoringCriterion,
  createScoringCriterion,
  deleteScoringCriterion,
  reorderScoringCriteria,
  recalculateAgentScores,
  recalculateWorkspaceScores,
  getScoringStats,
} from "./service.js";
import { createOperationLog, updateOperationLog } from "../operation-logs/service.js";

const router = Router();

// ─── Schemas ───

const criterionSchema = z.object({
  criterionType: z.enum(["ai_relevance", "keyword_match", "freshness", "source_trust", "custom"]),
  label: z.string().min(1).max(100),
  weight: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1).optional(),
  isActive: z.boolean().default(true),
  config: z.record(z.unknown()).optional(),
});

const updateCriterionSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  weight: z.number().min(0).max(1).optional(),
  threshold: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

const recalculateSchema = z.object({
  agentId: z.string().uuid().optional(),
});

// ─── Routes ───

// Get scoring criteria for an agent
router.get("/agents/:agentId/criteria", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const criteria = await getAgentScoringCriteria(req.params.agentId, workspaceId);
    res.json({ success: true, data: criteria });
  } catch (err) {
    next(err);
  }
});

// Create a scoring criterion
router.post("/agents/:agentId/criteria", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const input = criterionSchema.parse(req.body);
    const criterion = await createScoringCriterion(req.params.agentId, workspaceId, input);
    res.status(201).json({ success: true, data: criterion });
  } catch (err) {
    next(err);
  }
});

// Update a scoring criterion (weight slider, label, active toggle)
router.patch("/criteria/:criterionId", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const input = updateCriterionSchema.parse(req.body);
    const criterion = await updateScoringCriterion(req.params.criterionId, input);
    res.json({ success: true, data: criterion });
  } catch (err) {
    next(err);
  }
});

// Delete a scoring criterion
router.delete("/criteria/:criterionId", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    await deleteScoringCriterion(req.params.criterionId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// Reorder scoring criteria
router.post("/agents/:agentId/criteria/reorder", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const input = reorderSchema.parse(req.body);
    const criteria = await reorderScoringCriteria(req.params.agentId, input.orderedIds);
    res.json({ success: true, data: criteria });
  } catch (err) {
    next(err);
  }
});

// Recalculate scores for an agent
router.post("/agents/:agentId/recalculate", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const result = await recalculateAgentScores(req.params.agentId, workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post("/recalculate", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const input = recalculateSchema.parse(req.body ?? {});

    const operationLog = await createOperationLog({
      userId: req.user!.sub,
      workspaceId,
      agentId: input.agentId ?? null,
      operationType: "scoring",
      entityType: "article",
      status: "running",
      message: input.agentId ? "Пересчитываю скоринг для агента" : "Пересчитываю скоринг для всех агентов",
      metadata: {
        agentId: input.agentId ?? null,
      },
    });

    const result = await recalculateWorkspaceScores(workspaceId, input.agentId);

    await updateOperationLog(operationLog.id, req.user!.sub, {
      status: "completed",
      message: `Перескоринг поставил в очередь ${result.articlesQueued} статей`,
      finishedAt: new Date(),
      metadata: {
        agentId: input.agentId ?? null,
        articlesQueued: result.articlesQueued,
        agentsProcessed: result.agentsProcessed,
      },
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get scoring statistics for workspace
router.get("/stats", authMiddleware, workspaceAuth, async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const stats = await getScoringStats(workspaceId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

export default router;
