import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error-handler.js";
import { getSubscriptionStatus, createPayment, cancelSubscription, downgradeNow, handleWebhook, } from "./service.js";
const router = Router();
// ─── Schemas ───
const createPaymentSchema = z.object({
    amount: z.number().positive(),
    plan: z.enum(["monthly", "yearly"]),
});
// ─── Routes ───
// GET current subscription
router.get("/", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const status = await getSubscriptionStatus(workspaceId);
        res.json({ success: true, data: status });
    }
    catch (err) {
        next(err);
    }
});
// POST create payment
router.post("/create", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const input = createPaymentSchema.parse(req.body);
        const result = await createPayment({ ...input, workspaceId });
        res.status(201).json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
});
// POST cancel (downgrade at period end)
router.post("/cancel", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const workspace = await cancelSubscription(workspaceId);
        res.json({ success: true, data: workspace });
    }
    catch (err) {
        next(err);
    }
});
// POST webhook (YooKassa callback — no auth, signed by provider)
router.post("/webhook", async (req, res, next) => {
    try {
        const result = await handleWebhook(req.body);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
});
// POST immediate downgrade
router.post("/downgrade-now", authMiddleware, async (req, res, next) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId)
            throw new AppError(400, "workspaceId required", "VALIDATION_ERROR");
        const workspace = await downgradeNow(workspaceId);
        res.json({ success: true, data: workspace });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=routes.js.map