import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import {
  generatePost,
  getStreamOperation,
  cleanupStreamOperation,
  listGeneratedPosts,
  getGeneratedPost,
  updateGeneratedPost,
  deleteGeneratedPost,
} from "./service.js";

const router = Router();

// ─── Schemas ───

const generatePostSchema = z.object({
  agentId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  articleIds: z.array(z.string().uuid()).optional(),
  customPrompt: z.string().optional(),
});

const generateDigestSchema = z.object({
  agentId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  articleCount: z.coerce.number().int().min(1).max(50).default(10),
});

const updatePostSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1),
});

// ─── Routes ───

// Generate a manual post
router.post("/post", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = generatePostSchema.parse(req.body);
    const result = await generatePost(
      {
        ...input,
        workspaceId,
        type: "manual",
      },
      req.user!.sub
    );
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Generate a digest
router.post("/digest", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = generateDigestSchema.parse(req.body);
    const result = await generatePost(
      {
        workspaceId,
        agentId: input.agentId,
        templateId: input.templateId,
        type: "digest",
      },
      req.user!.sub
    );
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// SSE stream for generation progress
router.get("/stream/:operationId", authMiddleware, async (req, res, next) => {
  try {
    const { operationId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Send initial heartbeat
    res.write(`:ok\n\n`);

    const interval = setInterval(() => {
      const op = getStreamOperation(operationId);

      if (!op) {
        res.write(
          `data: ${JSON.stringify({ status: "error", error: "Operation not found" })}\n\n`
        );
        clearInterval(interval);
        res.end();
        return;
      }

      // Send current state
      res.write(
        `data: ${JSON.stringify({
          status: op.status,
          content: op.content,
          chunks: op.chunks,
          error: op.error,
        })}\n\n`
      );

      if (op.status === "completed" || op.status === "error") {
        clearInterval(interval);
        cleanupStreamOperation(operationId);
        res.end();
      }
    }, 1000);

    // Cleanup on client disconnect
    req.on("close", () => {
      clearInterval(interval);
    });

    req.on("error", () => {
      clearInterval(interval);
    });
  } catch (err) {
    next(err);
  }
});

// ─── Generated Posts CRUD ───

// List generated posts
router.get("/posts", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const workspaceId = req.query.workspaceId as string;
    const agentId = req.query.agentId as string | undefined;
    const type = req.query.type as string | undefined;

    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await listGeneratedPosts(workspaceId, {
      limit,
      cursor: cursor ?? null,
      agentId,
      type,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get single generated post
router.get("/posts/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const post = await getGeneratedPost(req.params.id, workspaceId);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

// Update generated post
router.put("/posts/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = updatePostSchema.parse(req.body);
    const post = await updateGeneratedPost(req.params.id, workspaceId, input);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

// Delete generated post
router.delete("/posts/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await deleteGeneratedPost(req.params.id, workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
