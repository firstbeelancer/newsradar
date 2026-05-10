import express from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import {
  listSubjectAreas,
  getSubjectAreaById,
  updateSubjectAreaDefaults,
} from "./service.js";

const router = express.Router();

// ─── Schemas ───

const listQuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
});

const updateDefaultsSchema = z.object({
  defaultTopic: z.string().min(1).optional(),
  defaultAudience: z.string().min(1).optional(),
  defaultsJson: z.record(z.unknown()).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

// ─── Routes ───

// GET /api/v1/subject-areas — list all (public, no auth required)
router.get("/", async (req, res, next) => {
  try {
    const { workspaceId } = listQuerySchema.parse(req.query);
    const areas = await listSubjectAreas(workspaceId);
    res.json({ success: true, data: areas });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/subject-areas/:id
router.get("/:id", async (req, res, next) => {
  try {
    const area = await getSubjectAreaById(req.params.id);
    res.json({ success: true, data: area });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/subject-areas/:id — update defaults (admin only)
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const input = updateDefaultsSchema.parse(req.body);
    const area = await updateSubjectAreaDefaults(req.params.id, input);
    res.json({ success: true, data: area });
  } catch (err) {
    next(err);
  }
});

export default router;