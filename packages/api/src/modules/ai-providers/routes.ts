import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import {
  AI_PROVIDER_PROCESS_VALUES,
  createProvider,
  getProviderById,
  listProviders,
  updateProvider,
  duplicateProvider,
  assignProviderProcesses,
  deleteProvider,
  testProviderConnection,
} from "./service.js";
import {
  disconnectXaiOauth,
  getXaiOauthStatus,
  pollXaiOauth,
  startXaiOauth,
} from "./xai-oauth.js";

const router = Router();

// ─── Schemas ───

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["platform", "byok", "oauth"]),
  provider: z.enum(["openai", "anthropic", "openrouter", "google", "xai"]),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().max(100).default("gpt-4o-mini"),
  isActive: z.boolean().optional(),
  assignedTo: z.array(z.enum(AI_PROVIDER_PROCESS_VALUES)).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  model: z.string().max(100).optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  isActive: z.boolean().optional(),
  assignedTo: z.array(z.enum(AI_PROVIDER_PROCESS_VALUES)).optional(),
});

const assignSchema = z.object({
  providerId: z.string().uuid(),
  assignedTo: z.array(z.enum(AI_PROVIDER_PROCESS_VALUES)),
});

// ─── Routes ───

// xAI Grok OAuth (SuperGrok / X Premium+) — Hermes-compatible device code
router.get("/xai-oauth/status", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    const data = await getXaiOauthStatus({ userId: req.user!.sub, workspaceId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/xai-oauth/start", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    const data = await startXaiOauth({ userId: req.user!.sub, workspaceId });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/xai-oauth/poll", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    const data = await pollXaiOauth({ userId: req.user!.sub, workspaceId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.delete("/xai-oauth", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    const data = await disconnectXaiOauth({ userId: req.user!.sub, workspaceId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

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

router.post("/assign", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = assignSchema.parse(req.body);
    const provider = await assignProviderProcesses(input.providerId, workspaceId, input.assignedTo);
    res.json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/duplicate", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const provider = await duplicateProvider(req.params.id, workspaceId);
    res.status(201).json({ success: true, data: provider });
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
