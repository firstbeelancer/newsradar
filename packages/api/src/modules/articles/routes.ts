import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import {
  getArticleById,
  listArticles,
  searchArticles,
  addToFavorite,
  removeFromFavorite,
  getArticleWithScore,
  deleteAllArticles,
  deleteArticlesByAgent,
  ensureArticleExists,
  listArticleSelectionIds,
} from "./service.js";
import { createOperationLog } from "../operation-logs/service.js";
import { getTranslateQueue } from "../../lib/queues.js";
import { getLatestDeepSearchForArticle } from "../deepsearch/service.js";

const router = Router();

// ─── Schemas ───

const listQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isFavorite: z.enum(["true", "false"]).optional(),
  translatedOnly: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["date", "score"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const selectionQuerySchema = listQuerySchema.extend({
  maxIds: z.coerce.number().int().min(1).max(500).default(200),
});

const favoriteBodySchema = z.object({
  ttlMode: z.enum(["30d", "forever"]).optional(),
  note: z.string().max(1000).optional(),
}).optional();

// ─── Routes ───

// List articles (with filters)
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const filters = listQuerySchema.parse(req.query);

    const result = await listArticles({
      workspaceId: filters.workspaceId,
      agentId: filters.agentId,
      sourceId: filters.sourceId,
      status: filters.status,
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      isFavorite: filters.isFavorite === "true" ? true : filters.isFavorite === "false" ? false : undefined,
      translatedOnly: filters.translatedOnly === "true" ? true : filters.translatedOnly === "false" ? false : undefined,
      sortBy: filters.sortBy ?? "date",
      sortOrder: filters.sortOrder ?? "desc",
      limit,
      cursor: cursor ?? null,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.delete("/", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;

    const result = agentId
      ? await deleteArticlesByAgent(workspaceId, agentId)
      : await deleteAllArticles(workspaceId);
    await createOperationLog({
      userId: req.user!.sub,
      workspaceId,
      agentId,
      operationType: agentId ? "articles_delete_agent" : "articles_delete_all",
      entityType: agentId ? "agent_articles" : "articles",
      entityId: agentId,
      status: "success",
      message: agentId
        ? `Deleted ${result.deleted} articles for agent`
        : `Deleted ${result.deleted} articles`,
      metadata: { deletedCount: result.deleted, agentId },
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/selection", authMiddleware, async (req, res, next) => {
  try {
    const filters = selectionQuerySchema.parse(req.query);
    const result = await listArticleSelectionIds({
      workspaceId: filters.workspaceId,
      agentId: filters.agentId,
      sourceId: filters.sourceId,
      status: filters.status,
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      isFavorite: filters.isFavorite === "true" ? true : filters.isFavorite === "false" ? false : undefined,
      sortBy: filters.sortBy ?? "date",
      sortOrder: filters.sortOrder ?? "desc",
      limit: filters.maxIds,
      cursor: null,
      maxIds: filters.maxIds,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Full-text search
router.get("/search", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const workspaceId = req.query.workspaceId as string;
    const q = req.query.q as string;
    const agentId = req.query.agentId as string | undefined;
    const sourceId = req.query.sourceId as string | undefined;
    const isFavorite = req.query.isFavorite === "true" ? true : req.query.isFavorite === "false" ? false : undefined;

    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    if (!q) throw new AppError(400, "q (search query) required", "VALIDATION_ERROR");

    const result = await searchArticles(workspaceId, q, {
      limit,
      cursor: cursor ?? null,
      agentId,
      sourceId,
      isFavorite,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get article details
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const article = await getArticleById(req.params.id, workspaceId);
    res.json({ success: true, data: article });
  } catch (err) {
    next(err);
  }
});

// Get article with score
router.get("/:id/score", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await getArticleWithScore(req.params.id, workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get latest DeepSearch result for article
router.get("/:id/deepsearch", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const result = await getLatestDeepSearchForArticle(String(req.params.id), workspaceId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Add to favorites
router.post("/:id/favorite", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const input = favoriteBodySchema.parse(req.body);
    const article = await addToFavorite(req.params.id, workspaceId, {
      ttlMode: input?.ttlMode,
      note: input?.note,
    });
    res.json({ success: true, data: article });
  } catch (err) {
    next(err);
  }
});

// Remove from favorites
router.delete("/:id/favorite", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const article = await removeFromFavorite(req.params.id, workspaceId);
    res.json({ success: true, data: article });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/retranslate", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const article = await ensureArticleExists(req.params.id, workspaceId);
    const translateQueue = getTranslateQueue();
    const jobId = `retranslate-${article.id}-${Date.now()}`;

    await translateQueue.add(
      jobId,
      { articleId: article.id, force: true },
      { jobId, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } }
    );

    res.json({
      success: true,
      data: {
        articleId: article.id,
        queued: true,
        jobId,
        status: article.status,
        language: article.language,
        detectedLang: article.detectedLang,
        needsTranslation: article.needsTranslation,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
