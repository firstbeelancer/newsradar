/**
 * Re-queue articles stuck mid-pipeline after AI/provider outages:
 * - needs_translation / polluted titles → translate
 * - status=translated without progress → ingest/summary
 * - status=analyzed without score → scoring
 */
import { and, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import type { Logger } from "pino";
import { db } from "../db/index.js";
import { articles } from "../db/schema.js";
import {
  ingestAnalysisQueue,
  scoreArticleQueue,
  translateQueue,
} from "../connection/redis.js";

const MAX_BATCH = 40;
const STUCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes without update

async function safeAdd(
  add: () => Promise<unknown>,
  logger: Logger,
  meta: Record<string, unknown>
): Promise<boolean> {
  try {
    await add();
    return true;
  } catch (err) {
    logger.debug(
      { ...meta, err: err instanceof Error ? err.message : String(err) },
      "Skip stuck pipeline requeue"
    );
    return false;
  }
}

export async function requeueStuckTranslations(logger: Logger): Promise<number> {
  const threshold = new Date(Date.now() - STUCK_AFTER_MS);
  const stamp = Date.now();
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
    const jobId = `retranslate-stuck-${row.id}-${stamp}`;
    if (
      await safeAdd(
        () =>
          translateQueue.add(
            jobId,
            { articleId: row.id, force: true },
            {
              jobId,
              attempts: 3,
              backoff: { type: "exponential", delay: 10_000 },
              removeOnComplete: { count: 200 },
              removeOnFail: { count: 100 },
            }
          ),
        logger,
        { articleId: row.id, stage: "translate" }
      )
    ) {
      queued += 1;
    }
  }

  // Recover garbage titles/summaries from reasoning model leaks
  // (English instruction echo often lands in description/aiSummary, not only title).
  const polluted = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      or(
        ilike(articles.title, "<think%"),
        ilike(articles.title, "%The user wants me to%"),
        ilike(articles.title, "%I need to translate%"),
        ilike(articles.title, "%I need to summarize%"),
        sql`${articles.title} LIKE '%</think>%'`,
        ilike(articles.description, "%The user wants me to%"),
        ilike(articles.description, "%I need to summarize%"),
        ilike(articles.description, "%I need to translate%"),
        ilike(articles.description, "%Let me create%"),
        ilike(articles.description, "%based on the title information%"),
        ilike(articles.description, "%Пользователь хочет%"),
        ilike(articles.description, "%мне нужно сжать%"),
        ilike(articles.aiSummary, "%The user wants me to%"),
        ilike(articles.aiSummary, "%I need to summarize%"),
        ilike(articles.aiSummary, "%I need to translate%"),
        ilike(articles.aiSummary, "%Let me create%"),
        ilike(articles.aiSummary, "%based on the title information%"),
        ilike(articles.aiSummary, "%Пользователь хочет%"),
        ilike(articles.aiSummary, "%мне нужно сжать%")
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
      const jobId = `retranslate-polluted-${row.id}-${stamp}`;
      if (
        await safeAdd(
          () =>
            translateQueue.add(
              jobId,
              { articleId: row.id, force: true },
              {
                jobId,
                attempts: 3,
                backoff: { type: "exponential", delay: 10_000 },
                removeOnComplete: { count: 200 },
                removeOnFail: { count: 100 },
              }
            ),
          logger,
          { articleId: row.id, stage: "translate-polluted" }
        )
      ) {
        queued += 1;
      }
    }
  }

  // translated without further progress → summary/ingest
  const stuckTranslated = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.status, "translated"), lt(articles.updatedAt, threshold)))
    .limit(MAX_BATCH);

  for (const row of stuckTranslated) {
    const jobId = `reingest-stuck-${row.id}-${stamp}`;
    if (
      await safeAdd(
        () =>
          ingestAnalysisQueue.add(
            jobId,
            { articleId: row.id },
            {
              jobId,
              attempts: 3,
              backoff: { type: "exponential", delay: 8_000 },
              removeOnComplete: { count: 200 },
              removeOnFail: { count: 100 },
            }
          ),
        logger,
        { articleId: row.id, stage: "ingest" }
      )
    ) {
      queued += 1;
    }
  }

  // analyzed without score → scoring
  const stuckAnalyzed = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.status, "analyzed"), lt(articles.updatedAt, threshold)))
    .limit(MAX_BATCH);

  for (const row of stuckAnalyzed) {
    const jobId = `rescore-stuck-${row.id}-${stamp}`;
    if (
      await safeAdd(
        () =>
          scoreArticleQueue.add(
            jobId,
            { articleId: row.id },
            {
              jobId,
              attempts: 3,
              backoff: { type: "exponential", delay: 8_000 },
              removeOnComplete: { count: 200 },
              removeOnFail: { count: 100 },
            }
          ),
        logger,
        { articleId: row.id, stage: "score" }
      )
    ) {
      queued += 1;
    }
  }

  if (
    queued > 0 ||
    polluted.length > 0 ||
    stuck.length > 0 ||
    stuckTranslated.length > 0 ||
    stuckAnalyzed.length > 0
  ) {
    logger.info(
      {
        queued,
        stuckTranslate: stuck.length,
        polluted: polluted.length,
        stuckTranslated: stuckTranslated.length,
        stuckAnalyzed: stuckAnalyzed.length,
      },
      "Requeued stuck pipeline articles"
    );
  }

  return queued;
}
