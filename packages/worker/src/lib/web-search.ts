export type WebSearchProvider = "disabled" | "brave" | "tavily" | "serpapi" | "perplexity" | "grok";

export interface WebSearchSettings {
  provider: WebSearchProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxResults?: number;
}

export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
  provider: WebSearchProvider;
}

interface BraveSearchResult {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: string[];
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

interface CompatibleSource {
  title?: string;
  url?: string;
  snippet?: string;
}

interface CompatibleSearchResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  citations?: string[];
}

type FetchLike = typeof fetch;

function clampMaxResults(value: number | undefined): number {
  if (!Number.isFinite(value)) return 8;
  return Math.max(1, Math.min(Math.trunc(value ?? 8), 20));
}

function compactSnippet(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_200);
}

function normalizeBraveResult(result: BraveSearchResult): WebSearchSource | null {
  if (!result.url || !result.title) return null;

  return {
    title: result.title,
    url: result.url,
    snippet: compactSnippet([result.description, ...(result.extra_snippets ?? [])]),
    provider: "brave",
  };
}

function normalizeCompatibleSource(source: CompatibleSource, provider: WebSearchProvider): WebSearchSource | null {
  if (!source.url || !source.title) return null;
  return {
    title: source.title,
    url: source.url,
    snippet: compactSnippet([source.snippet]),
    provider,
  };
}

function parseCompatibleSources(body: CompatibleSearchResponse, provider: WebSearchProvider): WebSearchSource[] {
  const content = body.choices?.[0]?.message?.content?.trim();
  if (content) {
    const jsonMatch = /```json\s*([\s\S]*?)\s*```/i.exec(content);
    const rawJson = jsonMatch?.[1] ?? content;
    try {
      const parsed = JSON.parse(rawJson) as { sources?: CompatibleSource[] };
      return (parsed.sources ?? [])
        .map((source) => normalizeCompatibleSource(source, provider))
        .filter((source): source is WebSearchSource => Boolean(source));
    } catch {
      // Fall through to citations.
    }
  }

  return (body.citations ?? []).map((url, index) => ({
    title: `Source ${index + 1}`,
    url,
    snippet: "",
    provider,
  }));
}

function compatibleEndpoint(baseUrl: string | undefined, provider: WebSearchProvider): string {
  const fallback = provider === "grok" ? "https://api.x.ai/v1" : "https://api.perplexity.ai";
  const normalized = (baseUrl?.trim() || fallback).replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

async function runCompatibleSearch(
  query: string,
  settings: WebSearchSettings,
  fetchImpl: FetchLike,
  provider: WebSearchProvider
): Promise<WebSearchSource[]> {
  const endpoint = compatibleEndpoint(settings.baseUrl, provider);
  const model = settings.model?.trim() || (provider === "grok" ? "grok-3-mini" : "sonar");
  const maxResults = clampMaxResults(settings.maxResults);

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey?.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a web research adapter. Return only JSON: {\"sources\":[{\"title\":\"...\",\"url\":\"https://...\",\"snippet\":\"...\"}]}. Use real source URLs only.",
        },
        {
          role: "user",
          content: `Find up to ${maxResults} reliable external sources for this news query: ${query}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    throw new Error(`${provider} web search failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as CompatibleSearchResponse;
  return parseCompatibleSources(body, provider).slice(0, maxResults);
}

export async function runWebSearch(
  query: string,
  settings: WebSearchSettings,
  fetchImpl: FetchLike = fetch
): Promise<WebSearchSource[]> {
  const provider = settings.provider ?? "disabled";
  const apiKey = settings.apiKey?.trim();
  const maxResults = clampMaxResults(settings.maxResults);

  if (provider === "disabled" || !apiKey || !query.trim()) {
    return [];
  }

  if (provider === "perplexity" || provider === "grok") {
    return runCompatibleSearch(query, settings, fetchImpl, provider);
  }

  if (provider !== "brave") {
    return [];
  }

  const baseUrl = settings.baseUrl?.trim() || "https://api.search.brave.com/res/v1/web/search";
  const url = new URL(baseUrl);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("count", String(maxResults));
  url.searchParams.set("extra_snippets", "true");
  url.searchParams.set("safesearch", "moderate");

  const response = await fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as BraveSearchResponse;
  return (body.web?.results ?? [])
    .map(normalizeBraveResult)
    .filter((source): source is WebSearchSource => Boolean(source))
    .slice(0, maxResults);
}
