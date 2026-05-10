export interface CreatePaymentInput {
    amount: number;
    plan: "monthly" | "yearly";
    workspaceId: string;
}
export interface SubscriptionStatus {
    plan: string;
    periodEnd: Date | null;
    status: "active" | "cancelling" | "free";
    paymentPending?: boolean;
}
/**
 * Creates a YooKassa payment and stores a pending payment record.
 */
export declare function createPayment(input: CreatePaymentInput): Promise<{
    paymentId: string;
    paymentUrl: string | null;
    status: "pending" | "cancelled" | "succeeded" | "waiting_for_capture";
}>;
/**
 * Returns current subscription status for a workspace.
 */
export declare function getSubscriptionStatus(workspaceId: string): Promise<SubscriptionStatus>;
/**
 * Schedules downgrade: marks period_end so the workspace becomes free
 * at the end of the current paid period.
 */
export declare function cancelSubscription(workspaceId: string): Promise<{
    id: string;
    userId: string;
    name: string;
    plan: string;
    periodEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
}>;
/**
 * Immediate downgrade to free.
 */
export declare function downgradeNow(workspaceId: string): Promise<{
    id: string;
    userId: string;
    name: string;
    plan: string;
    periodEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
}>;
interface YookassaWebhookPayload {
    event: "payment.succeeded" | "payment.canceled" | "payment.waiting_for_capture" | "refund.succeeded";
    object: {
        id: string;
        status: string;
        amount: {
            value: string;
            currency: string;
        };
        metadata?: Record<string, string>;
        paid?: boolean;
    };
}
/**
 * Processes YooKassa webhook.
 */
export declare function handleWebhook(payload: YookassaWebhookPayload): Promise<{
    action: string;
    workspaceId: string;
    plan: "monthly" | "yearly";
    periodEnd: Date;
    paymentId?: undefined;
    event?: undefined;
} | {
    action: string;
    workspaceId: string;
    paymentId: string;
    plan?: undefined;
    periodEnd?: undefined;
    event?: undefined;
} | {
    action: string;
    event: "payment.waiting_for_capture" | "refund.succeeded";
    workspaceId?: undefined;
    plan?: undefined;
    periodEnd?: undefined;
    paymentId?: undefined;
}>;
/**
 * Daily job: downgrades workspaces whose period_end has passed.
 * Should be called from a cron job or background worker.
 */
export declare function runAutoDowngrade(): Promise<{
    downgraded: number;
    workspaces: {
        workspaceId: string;
        plan: string;
    }[];
}>;
export {};
//# sourceMappingURL=service.d.ts.map