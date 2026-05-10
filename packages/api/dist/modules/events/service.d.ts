import type { Response } from "express";
export declare function subscribeToOperations(workspaceId: string, res: Response): Promise<void>;
export declare function unsubscribeFromOperations(workspaceId: string, res: Response): void;
export declare function publishOperationUpdate(payload: {
    workspaceId: string;
    operationId: string;
    status: string;
    message?: string;
}): Promise<void>;
export declare function getActiveSubscriberCount(): number;
//# sourceMappingURL=service.d.ts.map