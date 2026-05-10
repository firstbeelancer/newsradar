import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "./error-handler.js";

// Extend the Express User interface (used by passport) so that
// req.user carries our TokenPayload shape and req.user!.sub resolves.
// Optional OAuth fields are included for passport strategy callbacks.
declare global {
  namespace Express {
    interface User {
      sub: string;
      email: string;
      name?: string;
      googleId?: string;
      yandexId?: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing or invalid Authorization header", "UNAUTHORIZED"));
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token", "UNAUTHORIZED"));
  }
}
