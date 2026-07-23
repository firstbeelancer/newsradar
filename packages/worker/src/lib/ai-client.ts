/**
 * ------------------------------------------------------------------
 * AI Client — OpenAI-compatible fetch-based client
 * ------------------------------------------------------------------
 * Supports: OpenAI, Anthropic, OpenRouter, Google
 * Functions:
 *   - complete()     → non-streaming completion
 *   - streamComplete() → streaming completion with onChunk callback
 * ------------------------------------------------------------------
 */

import { and, desc, eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { aiProviders } from "../db/schema.js";
import { decrypt } from "./encryption.js";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompleteOptions {
  messages: AiMessage[];
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  provider?: "openai" | "anthropic" | "openrouter" | "google" | "xai";
  workspaceId?: string;
  process?: "search" | "translation" | "ingest_analysis" | "scoring" | "generation" | "deepsearch";
  temperature?: number;
  maxTokens?: number;
  /**
   * Callback, вызываемый сразу после того, как провайдер и модель резолвятся,
   * но до HTTP-запроса. Используется, чтобы зафиксировать в логах,
   * какой именно провайдер/модель реально сработают (а не env-fallback).
   */
  onProviderResolved?: (info: {
    provider: string;
    baseUrl: string;
    model: string;
    source: "explicit-key" | "workspace-provider" | "env-fallback";
  }) => void;
}

export interface AiStreamOptions extends AiCompleteOptions {
  onChunk: (chunk: string) => void | Promise<void>;
}

interface AiTelemetry {
  lastError: string | null;
  lastSuccessAt: number | null;
}

const aiTelemetry: AiTelemetry = {
  lastError: null,
  lastSuccessAt: null,
};

export function getAiTelemetry(): AiTelemetry {
  return { ...aiTelemetry };
}

export function setAiTelemetryError(message: string): void {
  aiTelemetry.lastError = message;
}

/* ─── Provider helpers ─── */

function resolveEnvProvider(
  opts?: Pick<AiCompleteOptions, "provider" | "baseUrl" | "apiKey">
): {
  provider: "openai" | "anthropic" | "openrouter" | "google" | "xai";
  baseUrl: string;
  apiKey: string;
} {
  const provider = opts?.provider ?? env.PLATFORM_AI_PROVIDER;
  const baseUrl =
    opts?.baseUrl ??
    (provider === "openai"
      ? "https://api.openai.com/v1"
      : provider === "anthropic"
        ? "https://api.anthropic.com/v1"
        : provider === "google"
          ? "https://generativelanguage.googleapis.com/v1"
          : provider === "xai"
            ? "https://api.x.ai/v1"
            : env.PLATFORM_AI_BASE_URL);
  const apiKey =
    opts?.apiKey ??
    (provider === "openrouter"
      ? env.OPENROUTER_API_KEY ?? env.PLATFORM_AI_API_KEY ?? ""
      : provider === "xai"
        ? env.XAI_API_KEY ?? env.PLATFORM_AI_API_KEY ?? ""
        : env.PLATFORM_AI_API_KEY ?? "");

  return { provider, baseUrl, apiKey };
}

function normalizeAssignedTo(processes: unknown): string[] {
  return Array.isArray(processes) ? processes.filter((value): value is string => typeof value === "string") : [];
}

async function resolveProvider(
  opts: AiCompleteOptions
): Promise<{
  provider: "openai" | "anthropic" | "openrouter" | "google" | "xai";
  baseUrl: string;
  apiKey: string;
  model: string;
  source: "explicit-key" | "workspace-provider" | "env-fallback";
}> {
  if (opts.apiKey) {
    const envProvider = resolveEnvProvider(opts);
    return {
      ...envProvider,
      model: resolveModel(opts),
      source: "explicit-key",
    };
  }

  if (opts.workspaceId && opts.process) {
    const providers = await db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.workspaceId, opts.workspaceId), eq(aiProviders.isActive, true)))
      .orderBy(desc(aiProviders.updatedAt), desc(aiProviders.createdAt));

    const assigned = providers.filter((provider) =>
      normalizeAssignedTo(provider.assignedTo).includes(opts.process!)
    );
    const pool = assigned.length > 0 ? assigned : providers;

    const explicit = pool.find((provider) => {
      const providerMatches = opts.provider ? provider.provider === opts.provider : true;
      const modelMatches = opts.model ? provider.model === opts.model : true;
      return providerMatches && modelMatches;
    });

    const selected = explicit ?? pool[0];
    if (selected?.apiKeyEncrypted) {
      return {
        provider: selected.provider as "openai" | "anthropic" | "openrouter" | "google" | "xai",
        baseUrl:
          selected.baseUrl ??
          resolveEnvProvider({ provider: selected.provider as "openai" | "anthropic" | "openrouter" | "google" | "xai" }).baseUrl,
        apiKey: decrypt(selected.apiKeyEncrypted),
        model: opts.model ?? selected.model,
        source: "workspace-provider",
      };
    }
  }

  const envProvider = resolveEnvProvider(opts);
  return {
    ...envProvider,
    model: resolveModel(opts),
    source: "env-fallback",
  };
}

function sanitizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  const withoutQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  const withoutBearer = withoutQuotes.replace(/^Bearer\s+/i, "").trim();
  return withoutBearer.replace(/\s+/g, "");
}

function resolveModel(opts?: Pick<AiCompleteOptions, "model">): string {
  return opts?.model ?? env.PLATFORM_AI_MODEL;
}

function getHeaders(
  provider: string,
  apiKey: string
): Record<string, string> {
  if (provider === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };
  }
  // openai, openrouter, google all use Bearer auth.
  // OpenRouter требует HTTP-Referer + X-Title для атрибуции в дашборде аналитики,
  // иначе провайдер в OpenRouter Analytics показывается как «Unknown».
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (provider === "openrouter") {
    if (env.OPENROUTER_APP_URL) {
      headers["HTTP-Referer"] = env.OPENROUTER_APP_URL;
    } else if (env.DOMAIN) {
      headers["HTTP-Referer"] = env.DOMAIN.startsWith("http") ? env.DOMAIN : `https://${env.DOMAIN}`;
    }
    if (env.OPENROUTER_APP_NAME) {
      headers["X-Title"] = env.OPENROUTER_APP_NAME;
    }
  }

  return headers;
}

/* ─── Request body builders ─── */

function buildRequestBody(
  provider: string,
  model: string,
  messages: AiMessage[],
  temperature: number,
  maxTokens: number,
  stream: boolean
): unknown {
  if (provider === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");
    return {
      model,
      max_tokens: maxTokens,
      system: systemMsg?.content,
      messages: nonSystem.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      stream,
    };
  }

  if (provider === "google") {
    // Google Gemini format (via OpenAI-compatible endpoint or native)
    return {
      model,
      contents: messages.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };
  }

  // OpenAI / OpenRouter format
  return {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
    stream,
  };
}

function buildUrl(provider: string, baseUrl: string, stream: boolean): string {
  if (provider === "google" && !baseUrl.includes("/openai")) {
    // Native Google Gemini endpoint
    return `${baseUrl}/models/${env.PLATFORM_AI_MODEL}:generateContent`;
  }
  if (provider === "anthropic") {
    return stream
      ? `${baseUrl}/messages?anthropic-version=2023-06-01`
      : `${baseUrl}/messages`;
  }
  return `${baseUrl}/chat/completions`;
}

function shouldRetryOpenRouterWithAuto(
  provider: string,
  model: string,
  status: number,
  errorText: string
): boolean {
  if (provider !== "openrouter" || model === "openrouter/auto") {
    return false;
  }

  if (status === 429 || status >= 500) {
    return true;
  }

  const normalized = errorText.toLowerCase();
  return (
    normalized.includes("no endpoints found") ||
    normalized.includes("model not found") ||
    normalized.includes("provider returned error") ||
    normalized.includes("is not a valid model id") ||
    normalized.includes("does not exist") ||
    normalized.includes("temporarily rate-limited") ||
    normalized.includes("temporarily unavailable")
  );
}

function formatProviderError(status: number, errorText: string): string {
  if (status === 429) {
    return "AI-провайдер временно упёрся в лимит запросов. Попробуй ещё раз через минуту или переключи модель.";
  }

  if (status >= 500) {
    return "AI-провайдер сейчас отвечает нестабильно. Попробуй повторить запрос чуть позже.";
  }

  return `AI provider error ${status}: ${errorText.slice(0, 500)}`;
}

async function postCompletionRequest(opts: {
  provider: "openai" | "anthropic" | "openrouter" | "google" | "xai";
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
}): Promise<string> {
  const url = buildUrl(opts.provider, opts.baseUrl, false);
  const headers = getHeaders(opts.provider, opts.apiKey);
  const body = buildRequestBody(
    opts.provider,
    opts.model,
    opts.messages,
    opts.temperature,
    opts.maxTokens,
    false
  );

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const trimmedError = errorText.slice(0, 500);

    if (
      shouldRetryOpenRouterWithAuto(
        opts.provider,
        opts.model,
        response.status,
        trimmedError
      )
    ) {
      return postCompletionRequest({
        ...opts,
        model: "openrouter/auto",
      });
    }

    const formattedError = formatProviderError(response.status, trimmedError);
    aiTelemetry.lastError = formattedError;
    throw new Error(formattedError);
  }

  const data = (await response.json()) as unknown;
  aiTelemetry.lastError = null;
  aiTelemetry.lastSuccessAt = Date.now();
  return parseNonStreamingResponse(opts.provider, data);
}

/* ─── Response parsers ─── */

function parseNonStreamingResponse(
  provider: string,
  data: unknown
): string {
  if (provider === "anthropic") {
    const anthropicData = data as {
      content?: Array<{ type?: string; text?: string }>;
    };
    return anthropicData.content?.[0]?.text ?? "";
  }

  if (provider === "google") {
    const googleData = data as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return googleData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // OpenAI / OpenRouter
  const openAiData = data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return openAiData.choices?.[0]?.message?.content ?? "";
}

/* ─── Public API ─── */

/**
 * Send a non-streaming completion request to the AI provider.
 *
 * @returns The complete response text.
 */
export async function complete(opts: AiCompleteOptions): Promise<string> {
  const resolved = await resolveProvider(opts);
  const { provider, baseUrl, apiKey, model, source } = resolved;
  const sanitizedApiKey = sanitizeApiKey(apiKey);
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 4_000;

  if (!sanitizedApiKey) {
    throw new Error("No API key provided for AI completion");
  }

  // Сообщаем вызывающему коду, какой провайдер и модель реально выбраны,
  // чтобы в журнал операций / лог попало понятное имя (Alpha Owl / Sonar и т.п.).
  // Это закрывает ситуацию, когда владелец видит в OpenRouter Analytics сессии
  // ChatGPT или Sonar и не понимает, откуда они.
  opts.onProviderResolved?.({ provider, baseUrl, model, source });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    return await postCompletionRequest({
      provider,
      baseUrl,
      apiKey: sanitizedApiKey,
      model,
      messages: opts.messages,
      temperature,
      maxTokens,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && !aiTelemetry.lastError) {
      aiTelemetry.lastError = error.message;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send a streaming completion request to the AI provider.
 * Chunks are delivered via the `onChunk` callback.
 *
 * @returns The full aggregated response text.
 */
export async function streamComplete(opts: AiStreamOptions): Promise<string> {
  const resolved = await resolveProvider(opts);
  const { provider, baseUrl, apiKey, model } = resolved;
  const sanitizedApiKey = sanitizeApiKey(apiKey);
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 4_000;

  if (!sanitizedApiKey) {
    throw new Error("No API key provided for AI streaming completion");
  }

  // For providers without native SSE support, fall back to non-streaming
  if (provider === "google" && !baseUrl.includes("/openai")) {
    const text = await complete(opts);
    await opts.onChunk(text);
    return text;
  }

  const url = buildUrl(provider, baseUrl, true);
  const headers = getHeaders(provider, sanitizedApiKey);
  const body = buildRequestBody(
    provider,
    model,
    opts.messages,
    temperature,
    maxTokens,
    true
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const trimmedError = errorText.slice(0, 500);

      if (
        shouldRetryOpenRouterWithAuto(
          provider,
          model,
          response.status,
          trimmedError
        )
      ) {
        const text = await complete({
          ...opts,
          provider,
          baseUrl,
          apiKey: sanitizedApiKey,
          model: "openrouter/auto",
        });
        await opts.onChunk(text);
        return text;
      }

      const formattedError = formatProviderError(response.status, trimmedError);
      aiTelemetry.lastError = formattedError;
      throw new Error(formattedError);
    }

    if (!response.body) {
      throw new Error("No response body for streaming request");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          let chunkText = "";

          if (provider === "anthropic") {
            const parsed = JSON.parse(data) as {
              type?: string;
              delta?: { text?: string };
            };
            if (parsed.type === "content_block_delta") {
              chunkText = parsed.delta?.text ?? "";
            }
          } else {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
              }>;
            };
            chunkText = parsed.choices?.[0]?.delta?.content ?? "";
          }

          if (chunkText) {
            fullText += chunkText;
            await opts.onChunk(chunkText);
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }

    aiTelemetry.lastError = null;
    aiTelemetry.lastSuccessAt = Date.now();
    return fullText;
  } catch (error) {
    if (error instanceof Error && !aiTelemetry.lastError) {
      aiTelemetry.lastError = error.message;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
