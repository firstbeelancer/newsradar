/**
 * ------------------------------------------------------------------
 * Worker: fetch-source
 * ------------------------------------------------------------------
 * Fetches articles from RSS feeds and Telegram channels.
 * Performs raw hash dedup, inserts new articles, and queues
 * them for further processing (raw-dedup → translate → ...).
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { sources, articles, agents, agentSources } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { parseRssFeed } from "../lib/rss-parser.js";
import { parseTelegramChannel } from "../lib/telegram-parser.js";
import { checkRawDedup, computeRawHash } from "../lib/dedup.js";
import { fetchArticleText } from "../lib/article-extractor.js";
import { rawDedupQueue } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";
import { appendCollectionResult } from "./collection-results.js";

export interface FetchSourceJob {
  sourceId: string;
  operationId?: string;
}

/**
 * Resolve the agent associated with a source via agent_sources junction table.
 */
async function resolveAgentForSource(
  sourceId: string
): Promise<{ agentId: string; workspaceId: string } | null> {
  const result = await db
    .select({
      agentId: agentSources.agentId,
      workspaceId: agents.workspaceId,
    })
    .from(agentSources)
    .innerJoin(agents, eq(agentSources.agentId, agents.id))
    .where(eq(agentSources.sourceId, sourceId))
    .limit(1);

  return result[0] ?? null;
}

function isFinalAttempt(job: Job<FetchSourceJob>): boolean {
  const maxAttempts = typeof job.opts.attempts === "number" && job.opts.attempts > 0 ? job.opts.attempts : 1;
  return job.attemptsMade + 1 >= maxAttempts;
}

/**
 * Process a fetch-source job.
 */
export async function processFetchSource(
  job: Job<FetchSourceJob>,
  logger: Logger
): Promise<{ fetched: number; newArticles: number; duplicates: number; skippedStale: number }> {
  const { sourceId, operationId } = job.data;

  logger.info({ sourceId, jobId: job.id, operationId }, "Fetching source");

  // Load source
  const sourceResult = await db
    .select()
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);

  const source = sourceResult[0];
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  if (!source.isActive) {
    logger.warn({ sourceId }, "Source is inactive, skipping");
    return { fetched: 0, newArticles: 0, duplicates: 0, skippedStale: 0 };
  }

  // Resolve agent/workspace
  const agentRef = await resolveAgentForSource(sourceId);
  if (!agentRef) {
    logger.warn({ sourceId }, "No agent linked to source");
    return { fetched: 0, newArticles: 0, duplicates: 0, skippedStale: 0 };
  }

  // Fetch based on source type
  let fetchedCount = 0;
  let newCount = 0;
  let dupCount = 0;
  let skippedStale = 0;

  // 3-day freshness cutoff (TZ §8.1 + §2.8: «Новости хранятся 3 дня, затем удаляются,
  // кроме избранных». Сбор старых новостей не имеет смысла, только засоряет feed.
  // If pubDate is missing/invalid we keep the article — only known-old items get skipped.)
  const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
  const freshCutoff = Date.now() - STALE_AFTER_MS;

  function isStale(publishedAt: Date | null | undefined): boolean {
    if (!publishedAt) return false;
    const t = publishedAt.getTime();
    if (Number.isNaN(t)) return false;
    return t < freshCutoff;
  }

  try {
    if (source.type === "rss") {
      const result = await parseRssFeed(source.url);
      fetchedCount = result.items.length;
      logger.info(
        { sourceId, feed: result.feedTitle, items: fetchedCount },
        "RSS feed parsed"
      );

      for (const item of result.items) {
        if (isStale(item.pubDate)) {
          skippedStale++;
          continue;
        }
        const { isDuplicate, hash } = await checkRawDedup(
          item.link,
          item.title,
          item.guid
        );

        if (isDuplicate) {
          dupCount++;
          continue;
        }

        const fetchedContent =
          item.content || item.description
            ? ""
            : await fetchArticleText(item.link);
        const articleDescription = item.description || fetchedContent.slice(0, 700);
        const articleContent = item.content || fetchedContent || item.description;

        // Insert new article
        const [article] = await db
          .insert(articles)
          .values({
            title: item.title,
            description: articleDescription,
            content: articleContent,
            link: item.link,
            guid: item.guid || item.link,
            publishedAt: item.pubDate,
            author: item.author,
            sourceId: source.id,
            agentId: agentRef.agentId,
            workspaceId: agentRef.workspaceId,
            status: "fetched",
            language: "auto",
            needsTranslation: true,
            rawHash: hash,
          })
          .returning();

        newCount++;

        // Queue for raw dedup processing
        await rawDedupQueue.add(
          `raw-dedup-${article.id}`,
          { articleId: article.id },
          { jobId: `raw-dedup-${article.id}` }
        );
      }
    } else if (source.type === "telegram") {
      const username = source.channelUsername ?? source.url;
      const result = await parseTelegramChannel(username);
      fetchedCount = result.items.length;
      logger.info(
        { sourceId, channel: result.channelTitle, items: fetchedCount },
        "Telegram channel parsed"
      );

      for (const item of result.items) {
        if (isStale(item.date)) {
          skippedStale++;
          continue;
        }
        const { isDuplicate, hash } = await checkRawDedup(
          item.link,
          item.title,
          item.messageId
        );

        if (isDuplicate) {
          dupCount++;
          continue;
        }

        const [article] = await db
          .insert(articles)
          .values({
            title: item.title,
            description: item.content.slice(0, 500),
            content: item.content,
            link: item.link,
            guid: item.messageId,
            publishedAt: item.date,
            sourceId: source.id,
            agentId: agentRef.agentId,
            workspaceId: agentRef.workspaceId,
            status: "fetched",
            language: "auto",
            needsTranslation: true,
            rawHash: hash,
          })
          .returning();

        newCount++;

        await rawDedupQueue.add(
          `raw-dedup-${article.id}`,
          { articleId: article.id },
          { jobId: `raw-dedup-${article.id}` }
        );
      }
    } else {
      throw new Error(`Unknown source type: ${source.type}`);
    }

    // Update source stats
    await db
      .update(sources)
      .set({
        fetchCount: sql`${sources.fetchCount} + 1`,
        lastFetchAt: new Date(),
        fetchStatus: "success",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    logger.info(
      { sourceId, fetched: fetchedCount, new: newCount, duplicates: dupCount, skippedStale },
      "Source fetch complete"
    );

    // Update operation log with progress
    if (operationId) {
      try {
        await appendCollectionResult(operationId, {
          sourceId,
          sourceName: source.name,
          fetched: fetchedCount,
          new: newCount,
          duplicates: dupCount,
          skippedStale,
          status: "success",
        });
      } catch (logErr) {
        logger.warn({ err: String(logErr), operationId }, "Failed to update operation log");
      }
    }

    return {
      fetched: fetchedCount,
      newArticles: newCount,
      duplicates: dupCount,
      skippedStale,
    };
  } catch (err) {
    // Update source error stats
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ sourceId, err: errorMessage }, "Source fetch failed");

    await db
      .update(sources)
      .set({
        fetchStatus: "error",
        lastError: errorMessage,
        errorCount: sql`${sources.errorCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    // Update operation log with the terminal source error only.
    if (operationId && isFinalAttempt(job)) {
      try {
        await appendCollectionResult(operationId, {
          sourceId,
          sourceName: source?.name ?? "unknown",
          status: "error",
          error: errorMessage,
        });
      } catch (logErr) {
        logger.warn({ err: String(logErr), operationId }, "Failed to update operation log on error");
      }
    }

    // Re-throw original error so BullMQ can apply retry/backoff
    throw err;
  }
}
