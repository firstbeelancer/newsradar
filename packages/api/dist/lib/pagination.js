import { z } from "zod";
const cursorSchema = z.object({
    id: z.string(),
    sortValue: z.string().optional(),
});
export function encodeCursor(cursor) {
    return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
export function decodeCursor(str) {
    try {
        const parsed = JSON.parse(Buffer.from(str, "base64url").toString("utf8"));
        return cursorSchema.parse(parsed);
    }
    catch {
        return null;
    }
}
export const paginationQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
});
//# sourceMappingURL=pagination.js.map