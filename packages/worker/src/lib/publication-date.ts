import { safeFetchText } from "./safe-fetch.js";

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = match[2];
  }
  return attributes;
}

export function extractPublicationDateFromHtml(html: string): Date | null {
  const jsonLdDate = html.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/i)?.[1];
  const parsedJsonLdDate = parseDate(jsonLdDate);
  if (parsedJsonLdDate) return parsedJsonLdDate;

  for (const match of html.matchAll(/<(?:meta|time)\b[^>]*>/gi)) {
    const attributes = extractAttributes(match[0]);
    const marker = (attributes.itemprop ?? attributes.property ?? attributes.name ?? "").toLowerCase();
    if (!["datepublished", "article:published_time", "og:published_time"].includes(marker)) {
      continue;
    }
    const parsed = parseDate(attributes.content ?? attributes.datetime);
    if (parsed) return parsed;
  }

  return null;
}

export async function fetchPublicationDate(url: string): Promise<Date | null> {
  const { response, text } = await safeFetchText(url, {
    timeoutMs: 20_000,
    maxBytes: 3_000_000,
    userAgent: "NewsRadar/1.0 Article Date Fetcher",
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) return null;
  return extractPublicationDateFromHtml(text);
}
