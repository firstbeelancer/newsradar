import { ZodError } from "zod";
import pino from "pino";
import { sanitizeSecrets } from "../lib/sanitizer.js";
const logger = pino({ name: "error-handler" });
export class AppError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code = "APP_ERROR") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AppError";
        Error.captureStackTrace(this, this.constructor);
    }
}
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        logger.warn({ issues: sanitizeSecrets(issues) }, "Validation error");
        res.status(400).json({
            success: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid input", details: issues },
        });
        return;
    }
    if (err instanceof AppError) {
        logger.warn({ statusCode: err.statusCode, code: err.code, message: err.message }, "Application error");
        res.status(err.statusCode).json({
            success: false,
            error: { code: err.code, message: err.message },
        });
        return;
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error(sanitizeSecrets({ error: message, stack: err?.stack }), "Unhandled error");
    res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
};
//# sourceMappingURL=error-handler.js.map