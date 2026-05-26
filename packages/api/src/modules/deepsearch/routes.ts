import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import {
  deleteDeepSearchResult,
  getDeepSearchResult,
  getDeepsearchWebSearchSettings,
  getLatestDeepSearchForArticle,
  listDeepSearchResults,
  resolveDeepsearchWebSearchApiKey,
  startDeepSearch,
  updateDeepsearchWebSearchSettings,
} from "./service.js";

const router = Router();

const webSearchProviderSchema = z.enum(["disabled", "brave", "tavily", "serpapi", "perplexity"]);

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

const webSearchSettingsSchema = z.object({
  provider: webSearchProviderSchema,
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  model: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(20).optional(),
});

const testWebSearchSchema = webSearchSettingsSchema.partial().extend({
  query: z.string().optional(),
});

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

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    const result = await listDeepSearchResults(workspaceId, { cursor, limit, agentId });
    res.json({ success: true, data: result.data, next_cursor: result.next_cursor, has_more: result.has_more });
  } catch (err) {
    next(err);
  }
});

router.get("/settings/web-search", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    const result = await getDeepsearchWebSearchSettings(workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put("/settings/web-search", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    const input = webSearchSettingsSchema.parse(req.body);
    const result = await updateDeepsearchWebSearchSettings(workspaceId, input);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post("/settings/web-search/test", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    const input = testWebSearchSchema.parse(req.body);
    const currentSettings = await getDeepsearchWebSearchSettings(workspaceId);
    const provider = input.provider ?? currentSettings.provider;

    if (provider === "disabled") {
      res.json({ success: true, data: { ok: true, message: "Внешний поиск отключен" } });
      return;
    }

    if (provider !== "brave") {
      res.json({
        success: true,
        data: { ok: false, message: `Провайдер ${provider} сохранён, но тест подключения пока реализован только для Brave` },
      });
      return;
    }

    const apiKey = await resolveDeepsearchWebSearchApiKey(workspaceId, input.apiKey);
    if (!apiKey) {
      throw new AppError(400, "API key required", "DEEPSEARCH_WEB_SEARCH_KEY_REQUIRED");
    }

    const url = new URL(input.baseUrl?.trim() || currentSettings.baseUrl || "https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", input.query?.trim() || "OpenAI Anthropic AI news");
    url.searchParams.set("count", "1");
    url.searchParams.set("extra_snippets", "true");
    url.searchParams.set("safesearch", "moderate");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      throw new AppError(400, `Brave Search test failed with HTTP ${response.status}`, "DEEPSEARCH_WEB_SEARCH_TEST_FAILED");
    }

    const body = await response.json() as { web?: { results?: unknown[] } };
    res.json({
      success: true,
      data: {
        ok: true,
        message: "Brave Search подключен",
        resultCount: body.web?.results?.length ?? 0,
      },
    });
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

router.delete("/:resultId", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = requireWorkspaceId(req.query.workspaceId);
    await deleteDeepSearchResult(String(req.params.resultId), workspaceId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
