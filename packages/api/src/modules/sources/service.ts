import { eq, and, desc, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sources, articles, agents, agentSources } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { Source, NewSource } from "../../db/types.js";
import { probeRssBody, probeTelegramBody, telegramPreviewUrl } from "./source-probe.js";

export interface SourceAgentRef {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export type SourceWithAgents = Source & { agents: SourceAgentRef[] };

// ─── CRUD ───

export async function createSource(data: NewSource, agentId?: string) {
  if (agentId) {
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.workspaceId, data.workspaceId)),
    });
    if (!agent) {
      throw new AppError(404, "Agent not found", "AGENT_NOT_FOUND");
    }
  }

  return db.transaction(async (tx) => {
    const [source] = await tx.insert(sources).values(data).returning();
    if (agentId) {
      await tx.insert(agentSources).values({ agentId, sourceId: source.id });
    }
    return source;
  });
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
): Promise<PaginatedResult<SourceWithAgents>> {
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
    .orderBy(desc(sources.createdAt), desc(sources.id))
    .limit(params.limit + 1);

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue && decoded.id) {
      const cursorDate = new Date(decoded.sortValue);
      query = db
        .select()
        .from(sources)
        .where(
          and(
            ...conditions,
            or(
              lt(sources.createdAt, cursorDate),
              and(eq(sources.createdAt, cursorDate), lt(sources.id, decoded.id))
            )
          )
        )
        .orderBy(desc(sources.createdAt), desc(sources.id))
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

  const assignments = data.length > 0
    ? await db
        .select({
          sourceId: agentSources.sourceId,
          id: agents.id,
          name: agents.name,
          color: agents.color,
          icon: agents.icon,
        })
        .from(agentSources)
        .innerJoin(agents, eq(agentSources.agentId, agents.id))
        .where(
          and(
            inArray(agentSources.sourceId, data.map((source) => source.id)),
            eq(agents.workspaceId, workspaceId)
          )
        )
        .orderBy(agents.position, agents.name)
    : [];

  const agentsBySource = new Map<string, SourceAgentRef[]>();
  for (const assignment of assignments) {
    const refs = agentsBySource.get(assignment.sourceId) ?? [];
    refs.push({
      id: assignment.id,
      name: assignment.name,
      color: assignment.color,
      icon: assignment.icon,
    });
    agentsBySource.set(assignment.sourceId, refs);
  }

  return {
    data: data.map((source) => ({
      ...source,
      agents: agentsBySource.get(source.id) ?? [],
    })),
    nextCursor,
    hasMore,
  };
}

export async function updateSource(
  id: string,
  workspaceId: string,
  data: Partial<Pick<Source, "type" | "name" | "url" | "channelUsername" | "isActive">>
) {
  await getSourceById(id, workspaceId);

  // Switching a source back on is the user overruling the auto-quarantine, so
  // clear the failure streak. Without this it would be deactivated again after
  // a single failed run instead of getting a fresh MAX_CONSECUTIVE_SOURCE_ERRORS.
  const revival =
    data.isActive === true
      ? { consecutiveErrorCount: 0, quarantinedAt: null, lastError: null, fetchStatus: "never" as const }
      : {};

  const [updated] = await db
    .update(sources)
    .set({ ...data, ...revival, updatedAt: new Date() })
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

  if (source.type === "web") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 NewsRadar/1.0",
          Accept: "text/html,application/xhtml+xml,*/*",
        },
      });
      if (!response.ok) {
        return { success: false, status: response.status, message: `HTTP ${response.status}: ${response.statusText}` };
      }
      const body = await response.text();
      // Count article-like links as a heuristic
      const linkMatches = body.match(/<a[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) ?? [];
      const articleLinks = linkMatches.filter((m) => {
        const text = m.replace(/<[^>]+>/g, " ").trim();
        return text.length >= 15;
      });
      const count = articleLinks.length;
      return {
        success: count > 0,
        status: response.status,
        articles_found: count,
        message: count > 0
          ? `Страница доступна, найдено ~${count} ссылок на статьи`
          : "Страница доступна, но не найдено ссылок на статьи",
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
