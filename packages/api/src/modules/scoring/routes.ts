import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { getScoringConfig, updateScoringConfig, recalculateScores, getScoringStats } from "./service.js";

const router = Router();

// ─── Schemas ───

const aiWeightsSchema = z.object({
  relevance: z.number().min(0).max(100).optional(),
  novelty: z.number().min(0).max(100).optional(),
  hype: z.number().min(0).max(100).optional(),
  practical: z.number().min(0).max(100).optional(),
  local: z.number().min(0).max(100).optional(),
});

const metaWeightsSchema = z.object({
  aiWeight: z.number().min(0).max(1).optional(),
  ai_weight: z.number().min(0).max(1).optional(),
  keywordWeight: z.number().min(0).max(1).optional(),
  keyword_weight: z.number().min(0).max(1).optional(),
  freshnessWeight: z.number().min(0).max(1).optional(),
  freshness_weight: z.number().min(0).max(1).optional(),
  sourceTrustWeight: z.number().min(0).max(1).optional(),
  source_trust_weight: z.number().min(0).max(1).optional(),
});

const configUpdateSchema = z.object({
  // AI sub-criteria weights
  scoring_weights: aiWeightsSchema.optional(),
  // Meta weights for hybrid formula
  ...metaWeightsSchema.shape,
  // Chip filter toggles
  exclusive: z.boolean().optional(),
  actionable: z.boolean().optional(),
  trending: z.boolean().optional(),
  controversy: z.boolean().optional(),
  verified: z.boolean().optional(),
});

const recalculateSchema = z.object({
  agentId: z.string().uuid().optional(),
  articleId: z.string().uuid().optional(),
});

/**
 * Normalize incoming config data
 */
function normalizeConfigInput(raw: z.infer<typeof configUpdateSchema>) {
  const metaWeights: Record<string, number> = {};
  if (raw.aiWeight !== undefined) metaWeights.aiWeight = raw.aiWeight;
  if (raw.ai_weight !== undefined) metaWeights.aiWeight = raw.ai_weight;
  if (raw.keywordWeight !== undefined) metaWeights.keywordWeight = raw.keywordWeight;
  if (raw.keyword_weight !== undefined) metaWeights.keywordWeight = raw.keyword_weight;
  if (raw.freshnessWeight !== undefined) metaWeights.freshnessWeight = raw.freshnessWeight;
  if (raw.freshness_weight !== undefined) metaWeights.freshnessWeight = raw.freshness_weight;
  if (raw.sourceTrustWeight !== undefined) metaWeights.sourceTrustWeight = raw.sourceTrustWeight;
  if (raw.source_trust_weight !== undefined) metaWeights.sourceTrustWeight = raw.source_trust_weight;

  const chipFilters: Record<string, boolean> = {};
  if (raw.exclusive !== undefined) chipFilters.exclusive = raw.exclusive;
  if (raw.actionable !== undefined) chipFilters.actionable = raw.actionable;
  if (raw.trending !== undefined) chipFilters.trending = raw.trending;
  if (raw.controversy !== undefined) chipFilters.controversy = raw.controversy;
  if (raw.verified !== undefined) chipFilters.verified = raw.verified;

  return {
    metaWeights: Object.keys(metaWeights).length > 0 ? metaWeights : undefined,
    aiWeights: raw.scoring_weights,
    chipFilters: Object.keys(chipFilters).length > 0 ? chipFilters : undefined,
  };
}

// ─── Routes ───

// Get current scoring config
router.get("/config", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const config = await getScoringConfig(workspaceId);
    // Return both camelCase and snake_case for frontend compatibility
    res.json({
      success: true,
      data: {
        ...config,
        ai_weight: config.aiWeight,
        keyword_weight: config.keywordWeight,
        freshness_weight: config.freshnessWeight,
        source_trust_weight: config.sourceTrustWeight,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update scoring weights
router.post("/config", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const raw = configUpdateSchema.parse(req.body);
    const { metaWeights, aiWeights, chipFilters } = normalizeConfigInput(raw);
    const config = await updateScoringConfig(workspaceId, {
      metaWeights,
      aiWeights,
      chipFilters,
    });

    res.json({
      success: true,
      data: {
        ...config,
        ai_weight: config.aiWeight,
        keyword_weight: config.keywordWeight,
        freshness_weight: config.freshnessWeight,
        source_trust_weight: config.sourceTrustWeight,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Recalculate scores
router.post("/recalculate", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = recalculateSchema.parse(req.body);
    const result = await recalculateScores(workspaceId, input);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get scoring statistics
router.get("/stats", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const stats = await getScoringStats(workspaceId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

export default router;
