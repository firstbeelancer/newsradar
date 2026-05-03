import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import {
  createProvider,
  getProviderById,
  listProviders,
  updateProvider,
  deleteProvider,
  testProviderConnection,
} from "./service.js";

const router = Router();

// ─── Schemas ───

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["platform", "byok"]),
  provider: z.enum(["openai", "anthropic", "openrouter", "google"]),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().max(100).default("gpt-4o-mini"),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  model: z.string().max(100).optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Routes ───

// List providers
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const providers = await listProviders(workspaceId);
    res.json({ success: true, data: providers });
  } catch (err) {
    next(err);
  }
});

// Create provider
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = createSchema.parse(req.body);
    const provider = await createProvider({
      ...input,
      workspaceId,
    });
    res.status(201).json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

// Get provider details
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const provider = await getProviderById(req.params.id, workspaceId);
    // Mask the encrypted key
    const { apiKeyEncrypted, ...safe } = provider;
    res.json({
      success: true,
      data: {
        ...safe,
        hasKey: !!apiKeyEncrypted,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update provider
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = updateSchema.parse(req.body);
    const provider = await updateProvider(req.params.id, workspaceId, input);
    res.json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

// Delete provider
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await deleteProvider(req.params.id, workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// Test connection
router.post("/:id/test", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await testProviderConnection(req.params.id, workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
