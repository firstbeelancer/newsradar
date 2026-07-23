/**
 * Re-queue articles stuck with needs_translation=true so the feed eventually
 * recovers after AI/provider outages.
 */
import { and, eq, inArray, lt } from "drizzle-orm";
import type { Logger } from "pino";
import { db } from "../db/index.js";
import { articles } from "../db/schema.js";
import { translateQueue } from "../connection/redis.js";

const MAX_BATCH = 25;
const STUCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes without update

export async function requeueStuckTranslations(logger: Logger): Promise<number> {
  const threshold = new Date(Date.now() - STUCK_AFTER_MS);

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

  if (stuck.length === 0) {
    return 0;
  }

  let queued = 0;
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));

  for (const row of stuck) {
    const jobId = `retranslate-stuck-${row.id}-${hourBucket}`;
    try {
      await translateQueue.add(
        jobId,
        { articleId: row.id, force: true },
        {
          jobId,
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 100 },
        }
      );
      queued += 1;
    } catch (err) {
      // Duplicate jobId while still active is fine — skip.
      logger.debug(
        { articleId: row.id, err: err instanceof Error ? err.message : String(err) },
        "Skip stuck translation requeue"
      );
    }
  }

  if (queued > 0) {
    logger.info({ queued, candidates: stuck.length }, "Requeued stuck translation articles");
  }

  return queued;
}
