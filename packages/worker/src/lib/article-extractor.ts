import { cleanArticleText, stripHtml } from "./text-cleaner.js";
import { safeFetchText } from "./safe-fetch.js";

const MAX_HTML_BYTES = 1_500_000;
const MAX_EXTRACTED_CHARS = 8_000;

function decodeAttribute(text: string): string {
  return stripHtml(text.replace(/\\"/g, '"').replace(/\\'/g, "'"));
}

function extractMeta(html: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return cleanArticleText(decodeAttribute(match[1]));
  }

  return "";
}

export function extractArticleTextFromHtml(html: string): string {
  if (!html.trim()) return "";

  const metaDescription =
    extractMeta(html, "og:description") ||
    extractMeta(html, "twitter:description") ||
    extractMeta(html, "description");

  const articleMatch = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  const scope = articleMatch?.[1] ?? html;
  const paragraphMatches = [...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const paragraphs = paragraphMatches
    .map((match) => cleanArticleText(match[1] ?? ""))
    .filter((paragraph) => paragraph.length >= 60)
    .slice(0, 8);

  const extracted = [metaDescription, ...paragraphs]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return extracted.slice(0, MAX_EXTRACTED_CHARS);
}

export async function fetchArticleText(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return "";

  try {
    const { response, text } = await safeFetchText(url, {
      timeoutMs: 12_000,
      maxBytes: MAX_HTML_BYTES,
      maxRedirects: 3,
      userAgent: "Mozilla/5.0 NewsRadar/1.0 article summary fetcher",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return "";
    }

    return extractArticleTextFromHtml(text.slice(0, MAX_HTML_BYTES));
  } catch {
    return "";
  }
}
