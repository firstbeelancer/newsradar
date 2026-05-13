import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { subscribeToOperations, unsubscribeFromOperations } from "./service.js";

const router = Router();

const querySchema = z.object({
  workspaceId: z.string().uuid(),
});

// SSE endpoint for operation updates
router.get("/operations", authMiddleware, async (req, res, next) => {
  try {
    const { workspaceId } = querySchema.parse(req.query);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    res.write(`:ok\n\n`);

    await subscribeToOperations(workspaceId, res);

    req.on("close", () => {
      unsubscribeFromOperations(workspaceId, res);
    });

    req.on("error", () => {
      unsubscribeFromOperations(workspaceId, res);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
