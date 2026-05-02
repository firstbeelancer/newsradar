import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import {
  createOperationLog,
  getOperationLogById,
  listOperationLogs,
  updateOperationLog,
  deleteOperationLog,
} from "./service.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { AppError } from "../../middleware/error-handler.js";

const router = Router();

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  operationType: z.string().min(1).max(100),
  entityType: z.string().max(100).optional(),
  entityId: z.string().uuid().optional(),
  status: z.string().min(1).max(50),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  status: z.string().max(50).optional(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// List
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const workspaceId = req.query.workspaceId as string | undefined;
    const agentId = req.query.agentId as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await listOperationLogs({
      userId: req.user!.sub,
      workspaceId,
      agentId,
      status,
      limit,
      cursor: cursor ?? null,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get one
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const log = await getOperationLogById(req.params.id, req.user!.sub);
    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

// Create
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const log = await createOperationLog({
      ...input,
      userId: req.user!.sub,
      startedAt: new Date(),
    });
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

// Update
router.patch("/:id", authMiddleware, async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const updates: { status?: string; message?: string; metadata?: Record<string, unknown>; finishedAt?: Date } = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.message !== undefined) updates.message = input.message;
    if (input.metadata !== undefined) updates.metadata = input.metadata;
    if (input.status === "completed" || input.status === "failed") {
      updates.finishedAt = new Date();
    }

    const log = await updateOperationLog(req.params.id, req.user!.sub, updates);
    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

// Delete
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    await deleteOperationLog(req.params.id, req.user!.sub);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
