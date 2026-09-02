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
import { parseWebPage } from "../lib/web-parser.js";
import { checkRawDedup } from "../lib/dedup.js";
import { fetchArticleText } from "../lib/article-extractor.js";
import { fetchPublicationDate } from "../lib/publication-date.js";
import { rawDedupQueue } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";
import { appendCollectionResult } from "./collection-results.js";
import { decideSourceQuarantine } from "./source-health.js";

export interface FetchSourceJob {
  sourceId: string;
  operationId?: string;
}

export interface AgentRef {
  agentId: string;
  workspaceId: string;
}

/**
 * Resolve every agent associated with a source via the agent_sources junction.
 *
 * This used to `.limit(1)`. Collection queues one fetch job per *source* (see
 * deduplicateCollectionSources), so when a source was attached to two agents,
 * only whichever junction row happened to come back first ever received the
 * articles — the second agent's feed stayed silently empty and its tags and
 * weight matrix were never applied to that source at all.
 */
async function resolveAgentsForSource(sourceId: string): Promise<AgentRef[]> {
  return db
    .select({
      agentId: agentSources.agentId,
      workspaceId: agents.workspaceId,
    })
    .from(agentSources)
    .innerJoin(agents, eq(agentSources.agentId, agents.id))
    .where(eq(agentSources.sourceId, sourceId));
}

interface IngestItemInput {
  title: string;
  description: string;
  content: string;
  link: string;
  guid: string | null;
  publishedAt: Date | null;
  author?: string | null;
}

/**
 * Insert one fetched item into every agent subscribed to the source.
 * Dedup runs per agent, so each thematic feed keeps its own copy to score.
 */
async function ingestItemForAgents(
  item: IngestItemInput,
  sourceId: string,
  agentRefs: AgentRef[]
): Promise<{ inserted: number; duplicates: number }> {
  let inserted = 0;
  let duplicates = 0;

  for (const agentRef of agentRefs) {
    const { isDuplicate, hash } = await checkRawDedup(
      item.link,
      item.title,
      item.guid,
      agentRef.agentId
    );

    if (isDuplicate) {
      duplicates++;
      continue;
    }

    const [article] = await db
      .insert(articles)
      .values({
        title: item.title,
        description: item.description,
        content: item.content,
        link: item.link,
        guid: item.guid ?? item.link,
        publishedAt: item.publishedAt,
        author: item.author ?? undefined,
        sourceId,
        agentId: agentRef.agentId,
        workspaceId: agentRef.workspaceId,
        status: "fetched",
        language: "auto",
        needsTranslation: true,
        rawHash: hash,
      })
      .returning();

    inserted++;

    await rawDedupQueue.add(
      `raw-dedup-${article.id}`,
      { articleId: article.id },
      { jobId: `raw-dedup-${article.id}` }
    );
  }

  return { inserted, duplicates };
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
): Promise<{ fetched: number; newArticles: number; duplicates: number; skippedStale: number; skippedUndated: number }> {
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
    return { fetched: 0, newArticles: 0, duplicates: 0, skippedStale: 0, skippedUndated: 0 };
  }

  // Resolve agent/workspace
  const agentRefs = await resolveAgentsForSource(sourceId);
  if (agentRefs.length === 0) {
    logger.warn({ sourceId }, "No agent linked to source");
    return { fetched: 0, newArticles: 0, duplicates: 0, skippedStale: 0, skippedUndated: 0 };
  }

  // Fetch based on source type
  let fetchedCount = 0;
  let newCount = 0;
  let dupCount = 0;
  let skippedStale = 0;
  let skippedUndated = 0;

  // 3-day freshness cutoff (TZ §8.1 + §2.8: «Новости хранятся 3 дня, затем удаляются,
  // кроме избранных». Сбор старых новостей не имеет смысла, только засоряет feed.
  // Missing dates are resolved from article metadata; unresolved items are skipped.
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

      const MAX_FEED_ITEMS = 100;
      const MAX_DATE_LOOKUPS = 20;
      let dateLookups = 0;
      let undatedStaleBoundaryReached = false;

      for (const item of result.items.slice(0, MAX_FEED_ITEMS)) {
        let publishedAt = item.pubDate;

        if (isStale(publishedAt)) {
          skippedStale++;
          continue;
        }

        // Cheap pre-filter: if every subscribed agent already has this item,
        // skip the expensive date lookup and full-text fetch below.
        const preCheck = await Promise.all(
          agentRefs.map((ref) => checkRawDedup(item.link, item.title, item.guid, ref.agentId))
        );
        if (preCheck.every((check) => check.isDuplicate)) {
          dupCount++;
          continue;
        }

        if (!publishedAt) {
          if (undatedStaleBoundaryReached) {
            skippedStale++;
            continue;
          }
          if (dateLookups >= MAX_DATE_LOOKUPS) {
            skippedUndated++;
            continue;
          }

          dateLookups++;
          try {
            publishedAt = await fetchPublicationDate(item.link);
          } catch (dateError) {
            logger.warn(
              { sourceId, link: item.link, err: String(dateError) },
              "Failed to resolve article publication date"
            );
          }

          if (isStale(publishedAt)) {
            skippedStale++;
            // RSS/Atom feeds are conventionally newest-first. Stop resolving
            // older undated pages after the first confirmed stale entry.
            undatedStaleBoundaryReached = true;
            continue;
          }
          if (!publishedAt) {
            skippedUndated++;
            continue;
          }
        }

        const fetchedContent =
          item.content || item.description
            ? ""
            : await fetchArticleText(item.link);
        const articleDescription = item.description || fetchedContent.slice(0, 700);
        const articleContent = item.content || fetchedContent || item.description;

        const ingested = await ingestItemForAgents(
          {
            title: item.title,
            description: articleDescription,
            content: articleContent,
            link: item.link,
            guid: item.guid ?? null,
            publishedAt,
            author: item.author,
          },
          source.id,
          agentRefs
        );

        newCount += ingested.inserted;
        dupCount += ingested.duplicates;
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
        const ingested = await ingestItemForAgents(
          {
            title: item.title,
            description: item.content.slice(0, 500),
            content: item.content,
            link: item.link,
            guid: item.messageId,
            publishedAt: item.date,
          },
          source.id,
          agentRefs
        );

        newCount += ingested.inserted;
        dupCount += ingested.duplicates;
      }
    } else if (source.type === "web") {
      const result = await parseWebPage(source.url);
      fetchedCount = result.items.length;
      logger.info(
        { sourceId, page: result.pageTitle, items: fetchedCount },
        "Web page parsed"
      );

      const MAX_WEB_ITEMS = 50;

      for (const item of result.items.slice(0, MAX_WEB_ITEMS)) {
        if (isStale(item.date)) {
          skippedStale++;
          continue;
        }

        const preCheck = await Promise.all(
          agentRefs.map((ref) => checkRawDedup(item.link, item.title, item.guid, ref.agentId))
        );
        if (preCheck.every((check) => check.isDuplicate)) {
          dupCount++;
          continue;
        }

        let publishedAt = item.date;
        if (!publishedAt) {
          try {
            publishedAt = await fetchPublicationDate(item.link);
          } catch {
            // undated web items are allowed — use current time as fallback
          }
        }
        if (!publishedAt) {
          publishedAt = new Date();
        }

        if (isStale(publishedAt)) {
          skippedStale++;
          continue;
        }

        // Fetch full article text for better AI processing
        let fullContent = item.description;
        try {
          const extracted = await fetchArticleText(item.link);
          if (extracted) fullContent = extracted;
        } catch {
          // description is enough
        }

        const ingested = await ingestItemForAgents(
          {
            title: item.title,
            description: (item.description || fullContent).slice(0, 700),
            content: fullContent || item.description,
            link: item.link,
            guid: item.guid ?? null,
            publishedAt,
          },
          source.id,
          agentRefs
        );

        newCount += ingested.inserted;
        dupCount += ingested.duplicates;
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
        // errorCount stays cumulative — scoreSourceTrust reads it as an
        // all-time error rate. Only the consecutive streak resets.
        consecutiveErrorCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    logger.info(
      { sourceId, fetched: fetchedCount, new: newCount, duplicates: dupCount, skippedStale, skippedUndated },
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
          skippedUndated,
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
      skippedUndated,
    };
  } catch (err) {
    // Update source error stats
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ sourceId, err: errorMessage }, "Source fetch failed");

    const terminalFailure = isFinalAttempt(job);
    const { streak, quarantine: shouldQuarantine } = decideSourceQuarantine({
      previousStreak: source?.consecutiveErrorCount ?? 0,
      isFinalAttempt: terminalFailure,
    });

    await db
      .update(sources)
      .set({
        fetchStatus: "error",
        lastError: shouldQuarantine
          ? `Источник отключён автоматически после ${streak} неудачных сборов подряд. Последняя ошибка: ${errorMessage}`
          : errorMessage,
        errorCount: sql`${sources.errorCount} + 1`,
        ...(terminalFailure ? { consecutiveErrorCount: streak as number } : {}),
        ...(shouldQuarantine ? { isActive: false, quarantinedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    if (shouldQuarantine) {
      logger.warn(
        { sourceId, sourceName: source?.name, streak, err: errorMessage },
        "Source quarantined after repeated failures — deactivated until re-enabled"
      );
    }

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
