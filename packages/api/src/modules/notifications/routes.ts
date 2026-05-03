import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from "./service.js";

const router = Router();

// ─── Schemas ───

const querySchema = z.object({
  workspaceId: z.string().uuid(),
});

// ─── REST Routes ───

// GET /api/v1/notifications — list with cursor pagination
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await listNotifications(workspaceId, {
      limit,
      cursor: cursor ?? null,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/:id/read — mark as read
router.post("/:id/read", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const notif = await markAsRead(req.params.id, workspaceId);
    res.json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/read-all — mark all as read
router.post("/read-all", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await markAllAsRead(workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/notifications/:id — delete
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await deleteNotification(req.params.id, workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ─── SSE Route ───

// GET /api/v1/notifications/stream — live push
router.get("/stream", authMiddleware, async (req, res, next) => {
  try {
    const { workspaceId } = querySchema.parse(req.query);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    res.write(`:ok\n\n`);

    await subscribeToNotifications(workspaceId, res);

    req.on("close", () => {
      unsubscribeFromNotifications(workspaceId, res);
    });

    req.on("error", () => {
      unsubscribeFromNotifications(workspaceId, res);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
