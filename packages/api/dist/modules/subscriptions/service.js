import { eq, and, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { subscriptionPayments, workspaces } from "../../db/schema.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/error-handler.js";
// ─── YooKassa API helpers ───
const YOOKASSA_API_URL = "https://api.yookassa.ru/v3/payments";
function getAuthHeader() {
    const shopId = env.YOOKASSA_SHOP_ID ?? "";
    const secretKey = env.YOOKASSA_SECRET_KEY ?? "";
    return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}
/**
 * Creates a YooKassa payment and stores a pending payment record.
 */
export async function createPayment(input) {
    if (!env.YOOKASSA_SHOP_ID || !env.YOOKASSA_SECRET_KEY) {
        throw new AppError(503, "YooKassa not configured", "PAYMENT_PROVIDER_UNAVAILABLE");
    }
    const idempotenceKey = crypto.randomUUID();
    const body = {
        amount: {
            value: input.amount.toFixed(2),
            currency: "RUB",
        },
        capture: true,
        confirmation: {
            type: "redirect",
            return_url: env.YOOKASSA_RETURN_URL,
        },
        description: `NewsRadar ${input.plan} subscription`,
        metadata: {
            workspaceId: input.workspaceId,
            plan: input.plan,
        },
    };
    const response = await fetch(YOOKASSA_API_URL, {
        method: "POST",
        headers: {
            Authorization: getAuthHeader(),
            "Content-Type": "application/json",
            "Idempotence-Key": idempotenceKey,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new AppError(502, `YooKassa error: ${text.slice(0, 200)}`, "PAYMENT_PROVIDER_ERROR");
    }
    const data = (await response.json());
    // Store pending payment
    await db.insert(subscriptionPayments).values({
        workspaceId: input.workspaceId,
        provider: "yookassa",
        providerPaymentId: data.id,
        amount: input.amount.toFixed(2),
        currency: "RUB",
        status: "pending",
        plan: input.plan,
    });
    return {
        paymentId: data.id,
        paymentUrl: data.confirmation?.confirmation_url ?? null,
        status: data.status,
    };
}
/**
 * Returns current subscription status for a workspace.
 */
export async function getSubscriptionStatus(workspaceId) {
    const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
    });
    if (!workspace) {
        throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
    }
    const plan = workspace.plan ?? "free";
    const periodEnd = workspace.periodEnd ?? null;
    // Check for pending payment
    const pendingPayment = await db.query.subscriptionPayments.findFirst({
        where: and(eq(subscriptionPayments.workspaceId, workspaceId), eq(subscriptionPayments.status, "pending")),
    });
    // Determine effective status
    let status = "free";
    if (plan === "pro" || plan === "enterprise") {
        status = periodEnd && periodEnd < new Date() ? "cancelling" : "active";
    }
    return {
        plan,
        periodEnd,
        status,
        paymentPending: !!pendingPayment,
    };
}
/**
 * Schedules downgrade: marks period_end so the workspace becomes free
 * at the end of the current paid period.
 */
export async function cancelSubscription(workspaceId) {
    const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
    });
    if (!workspace) {
        throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
    }
    if (workspace.plan === "free") {
        throw new AppError(400, "Already on free plan", "ALREADY_FREE");
    }
    // Set period_end to now (will be picked up by auto-downgrade worker)
    const [updated] = await db
        .update(workspaces)
        .set({ periodEnd: new Date(), updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
        .returning();
    // Update any pending payments to cancelled
    await db
        .update(subscriptionPayments)
        .set({ status: "cancelled" })
        .where(and(eq(subscriptionPayments.workspaceId, workspaceId), eq(subscriptionPayments.status, "pending")));
    return updated;
}
/**
 * Immediate downgrade to free.
 */
export async function downgradeNow(workspaceId) {
    const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
    });
    if (!workspace) {
        throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
    }
    if (workspace.plan === "free") {
        throw new AppError(400, "Already on free plan", "ALREADY_FREE");
    }
    const [updated] = await db
        .update(workspaces)
        .set({ plan: "free", periodEnd: null, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
        .returning();
    // Update pending payments to cancelled
    await db
        .update(subscriptionPayments)
        .set({ status: "cancelled" })
        .where(and(eq(subscriptionPayments.workspaceId, workspaceId), eq(subscriptionPayments.status, "pending")));
    return updated;
}
/**
 * Processes YooKassa webhook.
 */
export async function handleWebhook(payload) {
    const { event, object } = payload;
    const paymentId = object.id;
    const paymentRecord = await db.query.subscriptionPayments.findFirst({
        where: eq(subscriptionPayments.providerPaymentId, paymentId),
    });
    if (!paymentRecord) {
        throw new AppError(404, "Payment not found", "PAYMENT_NOT_FOUND");
    }
    const workspaceId = paymentRecord.workspaceId;
    switch (event) {
        case "payment.succeeded": {
            // Upgrade workspace to pro
            const plan = object.metadata?.plan ?? "monthly";
            const now = new Date();
            const periodEnd = plan === "yearly"
                ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 23, 59, 59)
                : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 23, 59, 59);
            await db
                .update(workspaces)
                .set({ plan: "pro", periodEnd, updatedAt: new Date() })
                .where(eq(workspaces.id, workspaceId));
            await db
                .update(subscriptionPayments)
                .set({ status: "succeeded", paidAt: new Date() })
                .where(eq(subscriptionPayments.id, paymentRecord.id));
            return { action: "upgraded", workspaceId, plan, periodEnd };
        }
        case "payment.canceled": {
            await db
                .update(subscriptionPayments)
                .set({ status: "cancelled" })
                .where(eq(subscriptionPayments.id, paymentRecord.id));
            return { action: "cancelled", workspaceId, paymentId };
        }
        default: {
            return { action: "ignored", event };
        }
    }
}
// ─── Auto-downgrade worker ───
/**
 * Daily job: downgrades workspaces whose period_end has passed.
 * Should be called from a cron job or background worker.
 */
export async function runAutoDowngrade() {
    const now = new Date();
    const expiredWorkspaces = await db
        .select()
        .from(workspaces)
        .where(and(eq(workspaces.plan, "pro"), lte(workspaces.periodEnd, now)));
    const results = [];
    for (const ws of expiredWorkspaces) {
        await db
            .update(workspaces)
            .set({ plan: "free", periodEnd: null, updatedAt: new Date() })
            .where(eq(workspaces.id, ws.id));
        results.push({ workspaceId: ws.id, plan: "free" });
    }
    return { downgraded: results.length, workspaces: results };
}
//# sourceMappingURL=service.js.map