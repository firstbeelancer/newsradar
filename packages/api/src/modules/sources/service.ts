import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sources, articles, agentSources } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { Source, NewSource } from "../../db/types.js";
import { probeRssBody, probeTelegramBody, telegramPreviewUrl } from "./source-probe.js";

// ─── CRUD ───

export async function createSource(data: NewSource) {
  const [source] = await db.insert(sources).values(data).returning();
  return source;
}

export async function getSourceById(id: string, workspaceId: string) {
  const source = await db.query.sources.findFirst({
    where: and(eq(sources.id, id), eq(sources.workspaceId, workspaceId)),
  });
  if (!source) {
    throw new AppError(404, "Source not found", "SOURCE_NOT_FOUND");
  }
  return source;
}

export async function listSources(
  workspaceId: string,
  params: { limit: number; cursor?: string | null; type?: string; isActive?: boolean }
): Promise<PaginatedResult<Source>> {
  const conditions = [eq(sources.workspaceId, workspaceId)];

  if (params.type) {
    conditions.push(eq(sources.type, params.type));
  }
  if (params.isActive !== undefined) {
    conditions.push(eq(sources.isActive, params.isActive));
  }

  let query = db
    .select()
    .from(sources)
    .where(and(...conditions))
    .orderBy(desc(sources.createdAt))
    .limit(params.limit + 1);

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      query = db
        .select()
        .from(sources)
        .where(
          and(
            ...conditions,
            sql`${sources.createdAt} < ${new Date(decoded.sortValue)}`
          )
        )
        .orderBy(desc(sources.createdAt))
        .limit(params.limit + 1);
    }
  }

  const rows = await query;
  const hasMore = rows.length > params.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;

  const lastItem = data[data.length - 1];
  const nextCursor: string | null =
    hasMore && lastItem
      ? encodeCursor({
          id: lastItem.id,
          sortValue: lastItem.createdAt.toISOString(),
        } as Cursor)
      : null;

  return { data, nextCursor, hasMore };
}

export async function updateSource(
  id: string,
  workspaceId: string,
  data: Partial<Pick<Source, "type" | "name" | "url" | "channelUsername" | "isActive">>
) {
  await getSourceById(id, workspaceId);

  const [updated] = await db
    .update(sources)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(sources.id, id), eq(sources.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function deleteSource(id: string, workspaceId: string) {
  await getSourceById(id, workspaceId);

  // Unlink from all agents first
  await db.delete(agentSources).where(eq(agentSources.sourceId, id));

  await db.delete(sources).where(and(eq(sources.id, id), eq(sources.workspaceId, workspaceId)));
  return { deleted: true };
}

// ─── Source testing ───

export async function testSource(id: string, workspaceId: string) {
  const source = await getSourceById(id, workspaceId);

  // Basic connectivity test based on source type
  if (source.type === "rss") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(source.url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "NewsRadar/1.0 RSS Fetcher",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();
      const probe = probeRssBody(body);
      const success = probe.validXml && probe.articleCount > 0;

      return {
        success,
        status: response.status,
        contentType,
        bodyPreview: body.slice(0, 500),
        articles_found: probe.articleCount,
        dated_articles_found: probe.datedArticleCount,
        message: !probe.validXml
          ? "Response is not valid RSS/XML"
          : probe.articleCount === 0
            ? "RSS/XML contains no articles"
            : probe.datedArticleCount === 0
              ? `Valid feed with ${probe.articleCount} articles, but publication dates are missing`
              : `Valid feed with ${probe.articleCount} articles`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message };
    } finally {
      clearTimeout(timeout);
    }
  }

  if (source.type === "telegram") {
    // Public channel previews can be validated without a bot token.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(telegramPreviewUrl(source.channelUsername, source.url), {
        signal: controller.signal,
        headers: { "User-Agent": "NewsRadar/1.0 Telegram Fetcher" },
      });
      if (!response.ok) {
        return { success: false, status: response.status, message: `HTTP ${response.status}: ${response.statusText}` };
      }
      const articleCount = probeTelegramBody(await response.text());
      return {
        success: articleCount > 0,
        status: response.status,
        articles_found: articleCount,
        message: articleCount > 0
          ? `Telegram preview contains ${articleCount} messages`
          : "Telegram channel is unavailable, private, empty, or has no public preview",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { success: false, message: "Unknown source type" };
}

// ─── Manual fetch trigger ───

export async function triggerFetch(id: string, workspaceId: string) {
  const source = await getSourceById(id, workspaceId);

  if (!source.isActive) {
    throw new AppError(400, "Cannot fetch from inactive source", "SOURCE_INACTIVE");
  }

  // Resolve the agent linked to this source
  const agentRef = await db
    .select({ agentId: agentSources.agentId })
    .from(agentSources)
    .where(eq(agentSources.sourceId, id))
    .limit(1);

  if (!agentRef[0]) {
    throw new AppError(400, "Source is not linked to any agent", "SOURCE_NO_AGENT");
  }

  // Queue a real BullMQ job
  const { getFetchSourceQueue } = await import("../../lib/queues.js");
  const fetchQueue = getFetchSourceQueue();

  const job = await fetchQueue.add("fetch-source", {
    sourceId: id,
  }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });

  const operationId = crypto.randomUUID();
  return {
    operationId,
    jobId: job.id,
    sourceId: id,
    status: "queued",
    message: "Manual fetch queued",
  };
}

// ─── Source article count ───

export async function getSourceArticleCounts(workspaceId: string) {
  const rows = await db
    .select({
      sourceId: articles.sourceId,
      count: sql<number>`count(*)`,
    })
    .from(articles)
    .where(eq(articles.workspaceId, workspaceId))
    .groupBy(articles.sourceId);

  return rows.reduce(
    (acc, row) => {
      acc[row.sourceId] = Number(row.count);
      return acc;
    },
    {} as Record<string, number>
  );
}
