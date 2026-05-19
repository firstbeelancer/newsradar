import { z } from "zod";

const cursorSchema = z.object({
  id: z.string(),
  sortValue: z.string().optional(),
  secondarySortValue: z.string().optional(),
});

export type Cursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(str: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(str, "base64url").toString("utf8"));
    return cursorSchema.parse(parsed);
  } catch {
    return null;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
