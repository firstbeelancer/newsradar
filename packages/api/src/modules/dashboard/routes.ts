import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { getDashboardData, collectAllAgents, getPipelineStatus } from "./service.js";

const router = Router();

const workspaceQuerySchema = z.object({
  workspaceId: z.string().uuid(),
});

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { workspaceId } = workspaceQuerySchema.parse(req.query);
    const data = await getDashboardData({ userId: req.user!.sub, workspaceId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/pipeline", authMiddleware, async (req, res, next) => {
  try {
    const { workspaceId } = workspaceQuerySchema.parse(req.query);
    const data = await getPipelineStatus({ userId: req.user!.sub, workspaceId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/collect-all", authMiddleware, async (req, res, next) => {
  try {
    const { workspaceId } = workspaceQuerySchema.parse(req.query);
    const result = await collectAllAgents({ userId: req.user!.sub, workspaceId });
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
