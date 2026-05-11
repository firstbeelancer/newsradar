import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { generatedPosts, articles, contentTemplates, aiProviders } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import type { PaginatedResult, Cursor } from "../../lib/pagination.js";
import { encodeCursor, decodeCursor } from "../../lib/pagination.js";
import type { GeneratedPost, NewGeneratedPost } from "../../db/types.js";
import { generatePostQueue, generateDigestQueue, redis } from "../../lib/queue.js";

// ─── Generation types ───

export interface GeneratePostInput {
  workspaceId: string;
  agentId?: string;
  templateId?: string;
  articleIds?: string[];
  customPrompt?: string;
  type: "manual" | "digest" | "deepsearch";
}

export interface StreamOperation {
  id: string;
  status: "pending" | "generating" | "completed" | "error";
  content: string;
  error?: string;
  chunks: string[];
}

// In-memory store for stream operations (supplemented by Redis pub/sub)
const streamStore = new Map<string, StreamOperation>();

// ─── Content generation ───

export async function generatePost(
  input: GeneratePostInput,
  _userId: string
): Promise<{ operationId: string; status: string }> {
  const operationId = crypto.randomUUID();
  const { workspaceId, templateId, articleIds, customPrompt, type, agentId } = input;

  // Resolve template
  let template: typeof contentTemplates.$inferSelect | undefined;
  if (templateId) {
    template = await db.query.contentTemplates.findFirst({
      where: and(eq(contentTemplates.id, templateId), eq(contentTemplates.workspaceId, workspaceId)),
    });
  }
  if (!template) {
    // Find default template for the type
    template = await db.query.contentTemplates.findFirst({
      where: and(
        eq(contentTemplates.workspaceId, workspaceId),
        eq(contentTemplates.type, type === "manual" ? "short" : type === "digest" ? "digest" : "detailed"),
        eq(contentTemplates.isDefault, true)
      ),
    });
  }

  // Fetch articles to include
  let selectedArticleIds: string[] = [];
  if (articleIds && articleIds.length > 0) {
    selectedArticleIds = articleIds;
  } else if (agentId) {
    // Get top-scored recent articles for the agent
    const topArticles = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.workspaceId, workspaceId), eq(articles.agentId, agentId)))
      .orderBy(desc(articles.score), desc(articles.createdAt))
      .limit(10);
    selectedArticleIds = topArticles.map((a) => a.id);
  }

  // Initialize stream operation
  streamStore.set(operationId, {
    id: operationId,
    status: "pending",
    content: "",
    chunks: [],
  });

  // Subscribe to Redis pub/sub for this operation to update stream store
  const channel = `newsradar:generation:${operationId}`;
  const subscriber = redis.duplicate();
  subscriber.on("message", (_ch: string, message: string) => {
    try {
      const data = JSON.parse(message);
      const op = streamStore.get(operationId);
      if (!op) return;

      if (data.status === "pending") {
        op.status = "pending";
      } else if (data.status === "generating") {
        op.status = "generating";
        if (data.chunk) {
          op.chunks.push(data.chunk);
          op.content += data.chunk;
        }
      } else if (data.status === "completed") {
        op.status = "completed";
        op.content = data.content ?? op.content;
      } else if (data.status === "error") {
        op.status = "error";
        op.error = data.error ?? "Generation failed";
      }
      streamStore.set(operationId, op);

      // Clean up subscriber when done
      if (data.status === "completed" || data.status === "error") {
        subscriber.unsubscribe(channel);
        subscriber.quit();
        // Auto-cleanup stream store after 30 seconds
        setTimeout(() => streamStore.delete(operationId), 30_000);
      }
    } catch {
      // Ignore malformed messages
    }
  });
  subscriber.subscribe(channel);

  // Enqueue BullMQ job for the worker to process
  try {
    const resolvedTemplateId = template?.id;
    const resolvedAgentId = agentId ?? null;

    if (type === "digest") {
      await generateDigestQueue.add(
        "generate-digest",
        {
          agentId: resolvedAgentId!,
          templateId: resolvedTemplateId,
          operationId,
          workspaceId,
          period: "day",
        },
        {
          jobId: `digest:${operationId}`,
          attempts: 2,
        }
      );
    } else {
      // Manual post or deepsearch
      await generatePostQueue.add(
        "generate-post",
        {
          templateId: resolvedTemplateId ?? "",
          articleIds: selectedArticleIds,
          operationId,
          workspaceId,
          agentId: resolvedAgentId ?? undefined,
          customPrompt: type === "deepsearch" ? customPrompt : undefined,
        },
        {
          jobId: `gen:${operationId}`,
          attempts: 2,
        }
      );
    }
  } catch (queueErr) {
    // If queue fails, fall back to inline generation
    console.error("[generatePost] Queue enqueue failed, falling back to inline:", queueErr instanceof Error ? queueErr.message : String(queueErr));

    // Fallback: simulate generation
    const op = streamStore.get(operationId)!;
    op.status = "generating";
    streamStore.set(operationId, op);

    // Use inline AI provider if available
    const provider = await db.query.aiProviders.findFirst({
      where: and(eq(aiProviders.workspaceId, workspaceId), eq(aiProviders.isActive, true)),
    });

    if (provider?.apiKeyEncrypted) {
      // Inline AI generation (non-streaming fallback)
      try {
        const content = await callAiProviderInline(provider, input, template);
        op.status = "completed";
        op.content = content;

        // Save generated post
        await db.insert(generatedPosts).values({
          workspaceId,
          agentId: agentId ?? null,
          templateId: template?.id ?? null,
          type,
          title: "Generated post",
          content,
          articleCount: selectedArticleIds.length,
          articlesSnapshot: [],
          promptSnapshot: customPrompt ?? template?.userPrompt ?? "",
          modelSnapshot: provider.model,
        });
      } catch (aiErr) {
        op.status = "error";
        op.error = aiErr instanceof Error ? aiErr.message : "AI generation failed";
      }
    } else {
      // No provider available — simulate
      await simulateGeneration(operationId);
    }

    streamStore.set(operationId, op);

    // Auto-cleanup
    setTimeout(() => streamStore.delete(operationId), 30_000);
  }

  return { operationId, status: "queued" };
}

// ─── Inline AI provider fallback (non-streaming) ───

async function callAiProviderInline(
  provider: typeof aiProviders.$inferSelect,
  input: GeneratePostInput,
  template: typeof contentTemplates.$inferSelect | undefined
): Promise<string> {
  const { decrypt } = await import("../../lib/encryption.js");
  const apiKey = decrypt(provider.apiKeyEncrypted!);
  const baseUrl = provider.baseUrl ?? getDefaultBaseUrl(provider.provider);

  // Build article texts
  let articleTexts = "";
  if (input.articleIds && input.articleIds.length > 0) {
    const arts = await db
      .select()
      .from(articles)
      .where(and(eq(articles.workspaceId, input.workspaceId), sql`${articles.id} = ANY(${input.articleIds})`));
    articleTexts = arts.map((a) => `Title: ${a.title}\n${a.description ? `Description: ${a.description}\n` : ""}`).join("\n---\n");
  }

  const systemPrompt = template?.systemPrompt ?? "You are a professional news editor. Create engaging content based on the provided articles.";
  const userPrompt = input.customPrompt
    ?? template?.userPrompt?.replace(/\{\{content\}\}/g, articleTexts)
    ?? `Based on the following articles, create a ${input.type} post:\n\n${articleTexts}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    if (provider.provider === "openai" || provider.provider === "openrouter") {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`AI error ${response.status}`);
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? "";
    }

    if (provider.provider === "anthropic") {
      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Anthropic error ${response.status}`);
      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      return data.content?.[0]?.text ?? "";
    }

    return "AI provider not supported for inline generation. Please use the worker.";
  } finally {
    clearTimeout(timeout);
  }
}

async function simulateGeneration(operationId: string): Promise<void> {
  const sentences = [
    "Analyzing source materials...",
    "Extracting key insights...",
    "Structuring narrative...",
    "Refining language...",
    "Finalizing output...",
  ];

  let content = "";
  for (const sentence of sentences) {
    await new Promise((r) => setTimeout(r, 600));
    const op = streamStore.get(operationId);
    if (!op) break;
    content += `[${sentence}]\n`;
    op.chunks.push(`[${sentence}]`);
    op.content = content;
    streamStore.set(operationId, op);
  }

  const finalText =
    "Here is the generated content based on the analyzed articles.\n\nKey takeaways have been synthesized from multiple sources to provide a comprehensive overview of the topic.\n\nThis is a simulated generation — configure an AI provider in Settings to get real AI-generated content.";

  const op = streamStore.get(operationId);
  if (op) {
    op.content = finalText;
    op.chunks.push(finalText);
    streamStore.set(operationId, op);
  }
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case "openai": return "https://api.openai.com/v1";
    case "anthropic": return "https://api.anthropic.com/v1";
    case "openrouter": return "https://openrouter.ai/api/v1";
    case "google": return "https://generativelanguage.googleapis.com/v1";
    default: return "https://api.openai.com/v1";
  }
}

// ─── Stream operations ───

export function getStreamOperation(operationId: string): StreamOperation | undefined {
  return streamStore.get(operationId);
}

export function cleanupStreamOperation(operationId: string): void {
  streamStore.delete(operationId);
}

// ─── Generated posts CRUD ───

export async function listGeneratedPosts(
  workspaceId: string,
  params: { limit: number; cursor?: string | null; agentId?: string; type?: string }
): Promise<PaginatedResult<GeneratedPost>> {
  const conditions = [eq(generatedPosts.workspaceId, workspaceId)];

  if (params.agentId) {
    conditions.push(eq(generatedPosts.agentId, params.agentId));
  }
  if (params.type) {
    conditions.push(eq(generatedPosts.type, params.type));
  }

  let query = db
    .select()
    .from(generatedPosts)
    .where(and(...conditions))
    .orderBy(desc(generatedPosts.createdAt))
    .limit(params.limit + 1);

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded?.sortValue) {
      query = db
        .select()
        .from(generatedPosts)
        .where(
          and(
            ...conditions,
            sql`${generatedPosts.createdAt} < ${new Date(decoded.sortValue)}`
          )
        )
        .orderBy(desc(generatedPosts.createdAt))
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

export async function getGeneratedPost(id: string, workspaceId: string) {
  const post = await db.query.generatedPosts.findFirst({
    where: and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)),
  });
  if (!post) {
    throw new AppError(404, "Generated post not found", "POST_NOT_FOUND");
  }
  return post;
}

export async function updateGeneratedPost(
  id: string,
  workspaceId: string,
  data: { title?: string; content?: string }
) {
  await getGeneratedPost(id, workspaceId);

  const [updated] = await db
    .update(generatedPosts)
    .set({
      ...data,
      isEdited: true,
      updatedAt: new Date(),
    })
    .where(and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function deleteGeneratedPost(id: string, workspaceId: string) {
  await getGeneratedPost(id, workspaceId);
  await db
    .delete(generatedPosts)
    .where(and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)));
  return { deleted: true };
}

export async function markAsCopied(id: string, workspaceId: string) {
  const [updated] = await db
    .update(generatedPosts)
    .set({ isCopied: true, updatedAt: new Date() })
    .where(and(eq(generatedPosts.id, id), eq(generatedPosts.workspaceId, workspaceId)))
    .returning();
  return updated;
}
