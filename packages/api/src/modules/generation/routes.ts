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

function getUserSub(req: { user?: unknown }) {
  return (req.user as { sub: string } | undefined)?.sub ?? "";
}

function normalizeGenerationBody(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const raw = body as Record<string, unknown>;
  return {
    ...raw,
    agentId: raw.agentId ?? raw.agent_id,
    templateId: raw.templateId ?? raw.template_id,
    articleIds: raw.articleIds ?? raw.article_ids,
    articleCount: raw.articleCount ?? raw.article_count,
    customPrompt: raw.customPrompt ?? raw.custom_prompt,
    provider: raw.provider,
    model: raw.model,
    period: raw.period,
  };
}

const generatePostSchema = z.preprocess(
  normalizeGenerationBody,
  z.object({
    agentId: z.string().uuid().optional(),
    templateId: z.string().uuid().optional(),
    articleIds: z.array(z.string().uuid()).optional(),
    customPrompt: z.string().optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
);

const generateDigestSchema = z.preprocess(
  normalizeGenerationBody,
  z.object({
    agentId: z.string().uuid().optional(),
    articleIds: z.array(z.string().uuid()).optional(),
    templateId: z.string().uuid().optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    period: z.enum(["day", "week", "month"]).default("day"),
    articleCount: z.coerce.number().int().min(1).max(50).default(10),
  }).refine((value) => (value.agentId ?? value.articleIds?.length), {
    message: "agentId или articleIds обязательны",
  })
);

const updatePostSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1),
});

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
      getUserSub(req)
    );
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post("/digest", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = generateDigestSchema.parse(req.body);
    const result = await generatePost(
      {
        workspaceId,
        agentId: input.agentId,
        articleIds: input.articleIds,
        templateId: input.templateId,
        provider: input.provider,
        model: input.model,
        period: input.period,
        articleCount: input.articleCount,
        type: "digest",
      },
      getUserSub(req)
    );
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/stream/:operationId", authMiddleware, async (req, res, next) => {
  try {
    const operationId = String(req.params.operationId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(`:ok\n\n`);

    const interval = setInterval(() => {
      const op = getStreamOperation(operationId);

      if (!op) {
        res.write(`data: ${JSON.stringify({ status: "error", error: "Operation not found" })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }

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

    req.on("close", () => clearInterval(interval));
    req.on("error", () => clearInterval(interval));
  } catch (err) {
    next(err);
  }
});

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

router.get("/posts/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const post = await getGeneratedPost(String(req.params.id), workspaceId);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

router.put("/posts/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = updatePostSchema.parse(req.body);
    const post = await updateGeneratedPost(String(req.params.id), workspaceId, input);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

router.delete("/posts/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    await deleteGeneratedPost(String(req.params.id), workspaceId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
