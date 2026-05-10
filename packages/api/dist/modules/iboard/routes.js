import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { planCheck } from "../../middleware/plan-check.js";
import { AppError } from "../../middleware/error-handler.js";
import { getIboardStats, getTimeline, getLeaderboard, getSourcesHealth } from "./service.js";
const router = Router();
// ─── Schemas ───
const leaderboardQuerySchema = z.object({
    workspaceId: z.string().uuid(),
    limit: z.coerce.number().min(1).max(100).default(20),
});
// ─── Routes (all Pro-only via planCheck) ───
// GET /api/v1/iboard/stats — key metrics
router.get("/stats", authMiddleware, planCheck("iboard"), async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const stats = await getIboardStats(workspaceId);
        res.json({ success: true, data: stats });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/v1/iboard/timeline — activity timeline
router.get("/timeline", authMiddleware, planCheck("iboard"), async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const timeline = await getTimeline(workspaceId);
        res.json({ success: true, data: timeline });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/v1/iboard/leaderboard — top articles by score
router.get("/leaderboard", authMiddleware, planCheck("iboard"), async (req, res, next) => {
    try {
        const { workspaceId, limit } = leaderboardQuerySchema.parse(req.query);
        const entries = await getLeaderboard(workspaceId, limit);
        res.json({ success: true, data: entries });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/v1/iboard/sources-health — all sources health
router.get("/sources-health", authMiddleware, planCheck("iboard"), async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const health = await getSourcesHealth(workspaceId);
        res.json({ success: true, data: health });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=routes.js.map