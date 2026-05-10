import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "./error-handler.js";
export function authMiddleware(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return next(new AppError(401, "Missing or invalid Authorization header", "UNAUTHORIZED"));
    }
    const token = header.slice(7);
    try {
        const payload = verifyAccessToken(token);
        req.user = payload;
        next();
    }
    catch {
        next(new AppError(401, "Invalid or expired token", "UNAUTHORIZED"));
    }
}
//# sourceMappingURL=auth.js.map