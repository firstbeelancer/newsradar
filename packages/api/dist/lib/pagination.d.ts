import { z } from "zod";
declare const cursorSchema: z.ZodObject<{
    id: z.ZodString;
    sortValue: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    sortValue?: string | undefined;
}, {
    id: string;
    sortValue?: string | undefined;
}>;
export type Cursor = z.infer<typeof cursorSchema>;
export declare function encodeCursor(cursor: Cursor): string;
export declare function decodeCursor(str: string): Cursor | null;
export interface PaginatedResult<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
}
export declare const paginationQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export {};
//# sourceMappingURL=pagination.d.ts.map