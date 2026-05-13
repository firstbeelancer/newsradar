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
} from "./service.js";

const router = Router();

// ─── Schemas ───

const listQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isFavorite: z.enum(["true", "false"]).optional(),
});

// ─── Routes ───

// List articles (with filters)
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationQuerySchema.parse(req.query);
    const filters = listQuerySchema.parse(req.query);

    const result = await listArticles({
      workspaceId: filters.workspaceId,
      agentId: filters.agentId,
      status: filters.status,
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      isFavorite: filters.isFavorite === "true" ? true : filters.isFavorite === "false" ? false : undefined,
      limit,
      cursor: cursor ?? null,
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

    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
    if (!q) throw new AppError(400, "q (search query) required", "VALIDATION_ERROR");

    const result = await searchArticles(workspaceId, q, {
      limit,
      cursor: cursor ?? null,
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

// Add to favorites
router.post("/:id/favorite", authMiddleware, async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");

    const article = await addToFavorite(req.params.id, workspaceId);
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

export default router;
