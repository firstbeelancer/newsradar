export type WebSearchProvider = "disabled" | "brave" | "tavily" | "serpapi" | "perplexity";

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
