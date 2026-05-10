import type { Request, Response, NextFunction } from "express";
declare const FEATURE_PLANS: Record<string, string[]>;
export type ProFeature = keyof typeof FEATURE_PLANS;
/**
 * Middleware factory that restricts endpoint access by workspace plan.
 * Returns 403 if the workspace plan does not include the requested feature.
 *
 * @param feature - Feature key to check
 */
export declare function planCheck(feature: ProFeature): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=plan-check.d.ts.map