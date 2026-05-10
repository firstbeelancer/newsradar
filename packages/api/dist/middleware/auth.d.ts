import type { Request, Response, NextFunction } from "express";
import { type TokenPayload } from "../lib/jwt.js";
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}
export declare function authMiddleware(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map