import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { getScoringConfig, updateScoringConfig, recalculateScores, getScoringStats } from "./service.js";

const router = Router();

// ─── Schemas ───
// Accept BOTH snake_case (frontend) and camelCase keys for backwards compatibility

const weightsSchema = z.object({
  // camelCase (native)
  aiRelevance: z.number().min(0).max(1).optional(),
  keywordMatch: z.number().min(0).max(1).optional(),
  freshness: z.number().min(0).max(1).optional(),
  sourceTrust: z.number().min(0).max(1).optional(),
  // snake_case (frontend)
  ai_relevance: z.number().min(0).max(1).optional(),
  keyword_match: z.number().min(0).max(1).optional(),
  source_trust: z.number().min(0).max(1).optional(),
  // chip filters
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
 * Normalize incoming config data: merge snake_case into camelCase
 */
function normalizeConfigInput(raw: z.infer<typeof weightsSchema>) {
  return {
    weights: {
      aiRelevance: raw.aiRelevance ?? raw.ai_relevance,
      keywordMatch: raw.keywordMatch ?? raw.keyword_match,
      freshness: raw.freshness,
      sourceTrust: raw.sourceTrust ?? raw.source_trust,
    },
    chipFilters: {
      exclusive: raw.exclusive,
      actionable: raw.actionable,
      trending: raw.trending,
      controversy: raw.controversy,
      verified: raw.verified,
    },
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
        ai_relevance: config.aiRelevance,
        keyword_match: config.keywordMatch,
        source_trust: config.sourceTrust,
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

    const raw = weightsSchema.parse(req.body);
    const { weights, chipFilters } = normalizeConfigInput(raw);
    const config = await updateScoringConfig(workspaceId, weights, chipFilters);

    res.json({
      success: true,
      data: {
        ...config,
        ai_relevance: config.aiRelevance,
        keyword_match: config.keywordMatch,
        source_trust: config.sourceTrust,
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
