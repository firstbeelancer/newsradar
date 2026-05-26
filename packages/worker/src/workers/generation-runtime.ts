import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import { db } from "../db/index.js";
import { generatedPosts, operationLogs } from "../db/schema.js";
import { redis } from "../connection/redis.js";
import { complete, streamComplete } from "../lib/ai-client.js";

type ProviderName = "openai" | "anthropic" | "openrouter" | "google";
type GenerationStatus = "pending" | "generating" | "completed" | "error";

export interface PreparedGenerationJob {
  operationId: string;
  operationLogId: string;
  userId: string;
  workspaceId: string;
  agentId?: string;
  templateId?: string | null;
  articleIds: string[];
  articleCount: number;
  type: "manual" | "digest" | "deepsearch";
  systemPrompt: string;
  userPrompt: string;
  requestedProvider?: string;
  requestedModel?: string;
  emojiPack?: string[];
  allowHashtags?: boolean;
  title?: string;
  articlesSnapshot: Array<{
    id: string;
    title: string;
    link?: string | null;
    score?: string | number | null;
  }>;
}

interface ProgressState {
  status: GenerationStatus;
  content: string;
  chunks: string[];
  error?: string;
  timestamp?: number;
}

const stateTtlSeconds = 60 * 60;

function stateKey(operationId: string): string {
  return `newsradar:generation:state:${operationId}`;
}

function channel(operationId: string): string {
  return `newsradar:generation:${operationId}`;
}

async function publishProgress(operationId: string, state: ProgressState): Promise<void> {
  const payload = JSON.stringify({ ...state, timestamp: state.timestamp ?? Date.now() });
  await redis.set(stateKey(operationId), payload, "EX", stateTtlSeconds);
  await redis.publish(channel(operationId), payload);
}

function normalizeProvider(provider?: string): ProviderName | undefined {
  if (provider === "openai" || provider === "anthropic" || provider === "openrouter" || provider === "google") {
    return provider;
  }
  return undefined;
}

function sanitizeTelegramText(text: string, options: { allowHashtags: boolean }): string {
  let cleaned = text
    .replace(/\*\*/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();

  if (!options.allowHashtags) {
    cleaned = cleaned
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n")
      .replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  return cleaned;
}

function ensureLeadingEmoji(text: string, emojis: string[]): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/^\p{Extended_Pictographic}/u.test(trimmed)) return trimmed;
  const fallbackEmoji = emojis.find((emoji) => emoji === "📰") ?? emojis.find((emoji) => emoji === "📌") ?? emojis[0] ?? "📰";
  return `${fallbackEmoji} ${trimmed}`;
}

function appendFallbackHashtags(content: string, jobData: PreparedGenerationJob): string {
  if (!jobData.allowHashtags || /(^|\s)#[\p{L}\p{N}_-]+/u.test(content)) {
    return content;
  }

  const sourceText = [
    jobData.title,
    ...jobData.articlesSnapshot.map((article) => article.title),
    content.slice(0, 600),
  ].join(" ");

  const stopWords = new Set([
    "что",
    "как",
    "для",
    "или",
    "это",
    "the",
    "and",
    "with",
    "from",
    "into",
    "inside",
    "про",
    "при",
    "над",
    "под",
    "без",
    "после",
  ]);

  const tags = Array.from(sourceText.matchAll(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu))
    .map((match) => match[0])
    .map((word) => word.replace(/^[^A-Za-zА-Яа-я0-9]+|[^A-Za-zА-Яа-я0-9]+$/g, ""))
    .filter((word) => word.length >= 3 && !stopWords.has(word.toLowerCase()))
    .filter((word, index, words) => words.findIndex((item) => item.toLowerCase() === word.toLowerCase()) === index)
    .slice(0, 6)
    .map((word) => `#${word.replace(/-/g, "")}`);

  if (tags.length === 0) return content;
  return `${content.trim()}\n\n${tags.join(" ")}`;
}

function formatGenerationError(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return "AI generation timed out. Попробуй ещё раз или сократи комментарий к регенерации.";
  }
  return err instanceof Error ? err.message : "Generation failed";
}

async function updateLog(
  operationLogId: string,
  data: { status: string; message?: string; finishedAt?: Date; metadata?: Record<string, unknown> }
): Promise<void> {
  await db.update(operationLogs).set(data).where(eq(operationLogs.id, operationLogId));
}

export async function processPreparedGeneration(
  jobData: PreparedGenerationJob,
  logger: Logger
): Promise<{ postId: string; content: string }> {
  const chunks: string[] = [];
  const provider = normalizeProvider(jobData.requestedProvider);

  logger.info(
    { operationId: jobData.operationId, type: jobData.type, articleCount: jobData.articleCount },
    "Generation worker started"
  );

  await publishProgress(jobData.operationId, { status: "generating", content: "", chunks });
  await updateLog(jobData.operationLogId, {
    status: "running",
    message: jobData.type === "digest" ? "Собираю финальный дайджест" : "Собираю финальный пост",
  });

  try {
    let rawContent = "";
    try {
      rawContent = await streamComplete({
        messages: [
          { role: "system", content: jobData.systemPrompt },
          { role: "user", content: jobData.userPrompt },
        ],
        workspaceId: jobData.workspaceId,
        process: "generation",
        provider,
        model: jobData.requestedModel,
        temperature: 0.7,
        maxTokens: 4_000,
        onChunk: async (chunk) => {
          rawContent += chunk;
          chunks.push(chunk.slice(0, 200));
          await publishProgress(jobData.operationId, {
            status: "generating",
            content: rawContent,
            chunks,
          });
        },
      });
    } catch (err) {
      logger.warn({ operationId: jobData.operationId, err: formatGenerationError(err) }, "Streaming failed");
    }

    if (!rawContent.trim()) {
      rawContent = await complete({
        messages: [
          { role: "system", content: jobData.systemPrompt },
          { role: "user", content: jobData.userPrompt },
        ],
        workspaceId: jobData.workspaceId,
        process: "generation",
        provider,
        model: jobData.requestedModel,
        temperature: 0.7,
        maxTokens: 4_000,
      });
    }

    if (!rawContent.trim()) {
      throw new Error("AI provider returned an empty response. Попробуй повторить генерацию или выбери другую модель.");
    }

    const content = appendFallbackHashtags(ensureLeadingEmoji(
      sanitizeTelegramText(rawContent, { allowHashtags: Boolean(jobData.allowHashtags) }),
      jobData.emojiPack ?? []
    ), jobData);

    const [post] = await db
      .insert(generatedPosts)
      .values({
        workspaceId: jobData.workspaceId,
        agentId: jobData.agentId ?? null,
        templateId: jobData.templateId ?? null,
        type: jobData.type,
        title: jobData.title ?? "Generated post",
        content,
        articleCount: jobData.articleCount,
        articlesSnapshot: jobData.articlesSnapshot,
        promptSnapshot: JSON.stringify({
          systemPrompt: jobData.systemPrompt,
          userPrompt: jobData.userPrompt,
          emojiPack: jobData.emojiPack ?? [],
        }),
        modelSnapshot: jobData.requestedModel ?? "platform-ai",
      })
      .returning();

    await publishProgress(jobData.operationId, { status: "completed", content, chunks });
    await updateLog(jobData.operationLogId, {
      status: "completed",
      message: jobData.type === "digest" ? "Дайджест готов" : "Пост готов",
      finishedAt: new Date(),
      metadata: {
        articleCount: jobData.articleCount,
        articleIds: jobData.articleIds,
        generatedPostId: post.id,
        preview: content.slice(0, 280),
      },
    });

    logger.info({ operationId: jobData.operationId, postId: post.id }, "Generation worker completed");
    return { postId: post.id, content };
  } catch (err) {
    const error = formatGenerationError(err);
    await publishProgress(jobData.operationId, { status: "error", content: "", chunks, error });
    await updateLog(jobData.operationLogId, {
      status: "error",
      message: error,
      finishedAt: new Date(),
      metadata: {
        articleCount: jobData.articleCount,
        articleIds: jobData.articleIds,
      },
    });
    throw err;
  }
}
