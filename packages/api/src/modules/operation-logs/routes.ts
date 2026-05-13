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

const router = Router();

const operationStatusSchema = z.enum([
  "pending",
  "running",
  "success",
  "failed",
  "partial",
  "cancelled",
]);

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  operationType: z.string().min(1).max(100),
  entityType: z.string().max(100).optional(),
  entityId: z.string().uuid().optional(),
  status: operationStatusSchema,
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  status: operationStatusSchema.optional(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const finishedStatuses = new Set(["success", "failed", "partial", "cancelled"]);

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
      finishedAt: finishedStatuses.has(input.status) ? new Date() : undefined,
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
    if (input.status && finishedStatuses.has(input.status)) {
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
