import type { ErrorRequestHandler } from "express";
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, message: string, code?: string);
}
export declare const errorHandler: ErrorRequestHandler;
//# sourceMappingURL=error-handler.d.ts.map