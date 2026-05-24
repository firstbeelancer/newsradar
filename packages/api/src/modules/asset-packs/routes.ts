import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { createAssetPack, listAssetPacks, setDefaultAssetPack } from "./service.js";

const router = Router();

const setDefaultSchema = z.object({
  packId: z.string().uuid(),
});

const createPackSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  emojis: z.union([z.string(), z.array(z.string())]),
  setDefault: z.boolean().optional(),
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

router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = createPackSchema.parse(req.body);
    const pack = await createAssetPack(workspaceId, input);
    res.status(201).json({ success: true, data: pack });
  } catch (err) {
    next(err);
  }
});

export default router;
