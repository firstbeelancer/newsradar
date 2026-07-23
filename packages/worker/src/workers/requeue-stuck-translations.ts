/**
 * Re-queue articles stuck with needs_translation=true so the feed eventually
 * recovers after AI/provider outages.
 *
 * Also recovers articles whose titles were polluted by model thinking leaks
 * (e.g. "<think>The user wants me to translate...").
 */
import { and, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import type { Logger } from "pino";
import { db } from "../db/index.js";
import { articles } from "../db/schema.js";
import { translateQueue } from "../connection/redis.js";

const MAX_BATCH = 40;
const STUCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes without update

async function enqueueRetranslate(articleId: string, hourBucket: number, logger: Logger): Promise<boolean> {
  const jobId = `retranslate-stuck-${articleId}-${hourBucket}`;
  try {
    await translateQueue.add(
      jobId,
      { articleId, force: true },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      }
    );
    return true;
  } catch (err) {
    logger.debug(
      { articleId, err: err instanceof Error ? err.message : String(err) },
      "Skip stuck translation requeue"
    );
    return false;
  }
}

export async function requeueStuckTranslations(logger: Logger): Promise<number> {
  const threshold = new Date(Date.now() - STUCK_AFTER_MS);
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  let queued = 0;

  const stuck = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.needsTranslation, true),
        inArray(articles.status, ["fetched", "new", "translated"]),
        lt(articles.updatedAt, threshold)
      )
    )
    .limit(MAX_BATCH);

  for (const row of stuck) {
    if (await enqueueRetranslate(row.id, hourBucket, logger)) queued += 1;
  }

  // Recover already-scored garbage translations from reasoning model leaks.
  const polluted = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      or(
        ilike(articles.title, "<think%"),
        ilike(articles.title, "%The user wants me to%"),
        ilike(articles.title, "%I need to translate%"),
        sql`${articles.title} LIKE '%</think>%'`
      )
    )
    .limit(MAX_BATCH);

  if (polluted.length > 0) {
    const ids = polluted.map((row) => row.id);
    await db
      .update(articles)
      .set({
        needsTranslation: true,
        status: "fetched",
        updatedAt: new Date(),
      })
      .where(inArray(articles.id, ids));

    for (const row of polluted) {
      if (await enqueueRetranslate(row.id, hourBucket, logger)) queued += 1;
    }
  }

  if (queued > 0 || polluted.length > 0 || stuck.length > 0) {
    logger.info(
      { queued, stuck: stuck.length, polluted: polluted.length },
      "Requeued stuck/polluted translation articles"
    );
  }

  return queued;
}
