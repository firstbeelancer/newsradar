import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { listAssetPacks, setDefaultAssetPack } from "./service.js";

const router = Router();

const setDefaultSchema = z.object({
  packId: z.string().uuid(),
});

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const packs = await listAssetPacks(workspaceId);
    res.json({ success: true, data: packs });
  } catch (err) {
    next(err);
  }
});

router.post("/default", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = setDefaultSchema.parse(req.body);
    const pack = await setDefaultAssetPack(workspaceId, input.packId);
    res.json({ success: true, data: pack });
  } catch (err) {
    next(err);
  }
});

export default router;
