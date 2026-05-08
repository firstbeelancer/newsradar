import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { getArticleById } from "../articles/service.js";
import { generatePost } from "../generation/service.js";

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

router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = startDeepSearchSchema.parse(req.body);
    const article = await getArticleById(input.articleId, workspaceId);

    const customPrompt = input.customPrompt ?? [
      "Сделай DeepSearch-исследование по новости ниже на русском языке.",
      "Структура результата:",
      "1. Что произошло.",
      "2. Почему это важно.",
      "3. Возможные последствия.",
      "4. Что проверить дополнительно.",
      "5. Короткий редакторский вывод.",
      "",
      `Заголовок: ${article.title}`,
      article.description ? `Описание: ${article.description}` : "",
      `Ссылка: ${article.link}`,
    ].filter(Boolean).join("\n");

    const result = await generatePost(
      {
        workspaceId,
        agentId: input.agentId ?? article.agentId,
        articleIds: [article.id],
        customPrompt,
        type: "deepsearch",
      },
      req.user!.sub
    );

    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/:operationId", authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: {
      operationId: req.params.operationId,
      streamUrl: `/api/v1/generation/stream/${req.params.operationId}`,
      message: "DeepSearch выполняется через общий stream генерации.",
    },
  });
});

export default router;
