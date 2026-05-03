/**
 * ------------------------------------------------------------------
 * Deduplication — raw (hash) and semantic (pg_trgm) deduplication
 * ------------------------------------------------------------------
 */

import { createHash } from "crypto";
import { db } from "../db/index.js";
import { articles } from "../../api/src/db/schema.js";
import { eq, sql, and, ne } from "drizzle-orm";

/* ─── Raw dedup: MD5 hash ─── */

/**
 * Compute a raw dedup hash from URL + title.
 * Two different articles with the same URL+title are considered duplicates.
 */
export function computeRawHash(url: string, title: string): string {
  return createHash("md5").update(`${url}|${title}`).digest("hex");
}

/**
 * Compute a GUID hash for articles with stable GUIDs.
 */
export function computeGuidHash(guid: string): string {
  return createHash("md5").update(guid).digest("hex");
}

/**
 * Check if an article with the given raw hash already exists.
 */
export async function findByRawHash(
  rawHash: string
): Promise<{ id: string } | undefined> {
  const result = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.rawHash, rawHash))
    .limit(1);

  return result[0];
}

/**
 * Check if an article with the given GUID hash already exists.
 */
export async function findByGuidHash(
  guidHash: string
): Promise<{ id: string } | undefined> {
  // Store guid hash in rawHash column with a prefix for lookup
  const prefixedHash = `guid:${guidHash}`;
  const result = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.rawHash, prefixedHash))
    .limit(1);

  return result[0];
}

/**
 * Perform raw dedup check. Returns true if article is a duplicate.
 */
export async function checkRawDedup(
  url: string,
  title: string,
  guid?: string | null
): Promise<{ isDuplicate: boolean; hash: string; existingId?: string }> {
  // Prefer GUID-based dedup if available
  if (guid && guid.trim().length > 0) {
    const guidHash = computeGuidHash(guid);
    const prefixedHash = `guid:${guidHash}`;
    const existing = await findByGuidHash(guidHash);
    if (existing) {
      return { isDuplicate: true, hash: prefixedHash, existingId: existing.id };
    }
    return { isDuplicate: false, hash: prefixedHash };
  }

  // Fallback to URL+title hash
  const rawHash = computeRawHash(url, title);
  const existing = await findByRawHash(rawHash);
  if (existing) {
    return { isDuplicate: true, hash: rawHash, existingId: existing.id };
  }

  return { isDuplicate: false, hash: rawHash };
}

/* ─── Semantic dedup: pg_trgm similarity ─── */

export interface SemanticMatch {
  id: string;
  title: string;
  similarity: number;
}

/**
 * Find semantically similar articles using PostgreSQL pg_trgm.
 * Requires the pg_trgm extension to be enabled.
 *
 * @param articleId — the article to check against
 * @param title — article title for similarity comparison
 * @param threshold — minimum similarity (0.0–1.0), default 0.7
 * @param workspaceId — limit search to same workspace
 * @param agentId — limit search to same agent
 */
export async function findSemanticDuplicates(
  articleId: string,
  title: string,
  threshold: number = 0.7,
  workspaceId?: string,
  agentId?: string
): Promise<SemanticMatch[]> {
  // Build WHERE conditions
  const conditions: Array<ReturnType<typeof eq>> = [
    ne(articles.id, articleId), // exclude self
  ];

  if (workspaceId) {
    conditions.push(eq(articles.workspaceId, workspaceId));
  }
  if (agentId) {
    conditions.push(eq(articles.agentId, agentId));
  }

  // Use raw SQL for pg_trgm similarity function
  const similaritySql = sql<number>`similarity(${articles.title}, ${title})`;

  const results = await db
    .select({
      id: articles.id,
      title: articles.title,
      similarity: similaritySql,
    })
    .from(articles)
    .where(
      and(
        ...conditions,
        sql`${similaritySql} > ${threshold}`,
        sql`${articles.title} IS NOT NULL`
      )
    )
    .orderBy(sql`${similaritySql} DESC`)
    .limit(5);

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    similarity: Number(r.similarity),
  }));
}

/**
 * Mark an article as part of a semantic group.
 */
export async function assignSemanticGroup(
  articleId: string,
  groupId: string
): Promise<void> {
  await db
    .update(articles)
    .set({
      semanticGroupId: groupId,
      status: "deduped",
      updatedAt: new Date(),
    })
    .where(eq(articles.id, articleId));
}
