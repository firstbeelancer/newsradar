import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { getScoringConfig, updateScoringConfig, recalculateScores, getScoringStats } from "./service.js";
const router = Router();
// ─── Schemas ───
const weightsSchema = z.object({
    aiRelevance: z.number().min(0).max(1).optional(),
    keywordMatch: z.number().min(0).max(1).optional(),
    freshness: z.number().min(0).max(1).optional(),
    sourceTrust: z.number().min(0).max(1).optional(),
});
const recalculateSchema = z.object({
    agentId: z.string().uuid().optional(),
    articleId: z.string().uuid().optional(),
});
// ─── Routes ───
// Get current scoring config
router.get("/config", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const config = await getScoringConfig(workspaceId);
        res.json({ success: true, data: config });
    }
    catch (err) {
        next(err);
    }
});
// Update scoring weights
router.post("/config", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const input = weightsSchema.parse(req.body);
        const config = await updateScoringConfig(workspaceId, input);
        res.json({ success: true, data: config });
    }
    catch (err) {
        next(err);
    }
});
// Recalculate scores
router.post("/recalculate", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const input = recalculateSchema.parse(req.body);
        const result = await recalculateScores(workspaceId, input);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
});
// Get scoring statistics
router.get("/stats", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const stats = await getScoringStats(workspaceId);
        res.json({ success: true, data: stats });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=routes.js.map