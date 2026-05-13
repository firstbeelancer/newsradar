import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { getWorkspaceByUserId, createWorkspace, updateWorkspace, updatePlan } from "./service.js";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255),
});

const updatePlanSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]),
});

// Get current user's workspace
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const workspace = await getWorkspaceByUserId(req.user!.sub);
    res.json({ success: true, data: workspace });
  } catch (err) {
    next(err);
  }
});

// Create workspace
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const workspace = await createWorkspace(req.user!.sub, input.name);
    res.status(201).json({ success: true, data: workspace });
  } catch (err) {
    next(err);
  }
});

// Update workspace
router.patch("/me", authMiddleware, async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const workspace = await updateWorkspace(req.user!.sub, input.name);
    res.json({ success: true, data: workspace });
  } catch (err) {
    next(err);
  }
});

// Update plan
router.patch("/me/plan", authMiddleware, async (req, res, next) => {
  try {
    const input = updatePlanSchema.parse(req.body);
    const workspace = await updatePlan(req.user!.sub, input.plan);
    res.json({ success: true, data: workspace });
  } catch (err) {
    next(err);
  }
});

export default router;
