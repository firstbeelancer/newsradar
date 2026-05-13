import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { getUsageStatus } from "../../middleware/usage-check.js";

const router = Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const usage = await getUsageStatus(workspaceId);
    res.json({ success: true, data: usage });
  } catch (err) {
    next(err);
  }
});

export default router;
