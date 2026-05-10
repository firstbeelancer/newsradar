import { z } from "zod";
export declare function validateUrl(input: string): {
    valid: boolean;
    reason?: string;
};
export declare const urlSchema: z.ZodEffects<z.ZodString, string, string>;
//# sourceMappingURL=url-validator.d.ts.map