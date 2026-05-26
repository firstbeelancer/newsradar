import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import {
  getDeepSearchResult,
  getLatestDeepSearchForArticle,
  startDeepSearch,
} from "./service.js";

const router = Router();

const startDeepSearchSchema = z.preprocess(
  (body) => {
    if (!body || typeof body !== "object") return body;
    const raw = body as Record<string, unknown>;
    return {
      ...raw,
      articleId: raw.articleId ?? raw.article_id,
      agentId: raw.agentId ?? raw.agent_id,
      customPrompt: raw.customPrompt ?? raw.custom_prompt,
    };
  },
  z.object({
    articleId: z.string().uuid(),
    agentId: z.string().uuid().optional(),
    customPrompt: z.string().optional(),
  })
);

function requireWorkspaceId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
  }
  return value;
}

router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    const input = startDeepSearchSchema.parse(req.body);
    const result = await startDeepSearch({
      workspaceId,
      userId: (req.user as { sub: string }).sub,
      articleId: input.articleId,
      agentId: input.agentId,
      customPrompt: input.customPrompt,
    });

    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/article/:articleId/latest", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    const result = await getLatestDeepSearchForArticle(String(req.params.articleId), workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/:resultId", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    const result = await getDeepSearchResult(String(req.params.resultId), workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
