import { cleanArticleText } from "./text-cleaner.js";

/**
 * ------------------------------------------------------------------
 * RSS Parser - fetch RSS feeds and parse XML into article items
 * ------------------------------------------------------------------
 */

export interface RssItem {
  title: string;
  description: string;
  content: string;
  link: string;
  guid: string;
  pubDate: Date | null;
  author: string | null;
}

export interface RssParseResult {
  items: RssItem[];
  feedTitle?: string;
  feedDescription?: string;
}

interface XmlNode {
  text?: string;
  [key: string]: unknown;
}

/**
 * Ultra-lightweight XML parser for RSS/Atom feeds.
 * No external dependencies - uses regex-based parsing for speed.
 */
function parseXml(xml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const channelMatch = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
  if (channelMatch) {
    const channelContent = channelMatch[1];
    result.title = extractTag(channelContent, "title");
    result.description = extractTag(channelContent, "description");
  }

  if (!result.title) {
    result.title = extractTag(xml, "title");
  }

  const items: Array<Record<string, unknown>> = [];

  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[0];
    const pubDateStr = extractTag(itemXml, "pubDate");
    items.push({
      title: extractTag(itemXml, "title"),
      description: extractTag(itemXml, "description"),
      content: extractTag(itemXml, "content:encoded") || extractTag(itemXml, "content"),
      link: extractTag(itemXml, "link"),
      guid: extractTag(itemXml, "guid") || extractTag(itemXml, "link"),
      pubDate: pubDateStr ? parseDate(pubDateStr) : null,
      author:
        extractTag(itemXml, "author") ||
        extractTag(itemXml, "dc:creator") ||
        null,
    });
  }

  if (items.length === 0) {
    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[0];
      const updatedStr = extractTag(entryXml, "updated");
      const publishedStr = extractTag(entryXml, "published");
      const linkHref = extractAttribute(entryXml, "link", "href");
      const id = extractTag(entryXml, "id");

      items.push({
        title: extractTag(entryXml, "title"),
        description: extractTag(entryXml, "summary"),
        content: extractTag(entryXml, "content"),
        link: linkHref || id,
        guid: id || linkHref,
        pubDate: parseDate(publishedStr || updatedStr),
        author: extractAtomAuthor(entryXml),
      });
    }
  }

  result.items = items;
  return result;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = regex.exec(xml);
  if (!match) return "";
  return decodeXmlEntities(stripCdata(match[1].trim()));
}

function extractAttribute(
  xml: string,
  tag: string,
  attr: string
): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "i");
  const match = regex.exec(xml);
  return match?.[1] ?? "";
}

function extractAtomAuthor(entryXml: string): string | null {
  const authorMatch = /<author[\s\S]*?<\/author>/i.exec(entryXml);
  if (!authorMatch) return null;
  return extractTag(authorMatch[0], "name") || null;
}

function stripCdata(text: string): string {
  return text
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "");
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

export async function parseRssFeed(url: string): Promise<RssParseResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "NewsRadar/1.0 RSS Fetcher",
        Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    if (!xml.trim()) {
      throw new Error("Empty RSS feed response");
    }

    const hasXml =
      xml.trimStart().startsWith("<?xml") ||
      xml.includes("<rss") ||
      xml.includes("<feed") ||
      xml.includes("<RDF");

    if (!hasXml) {
      throw new Error("Response is not valid RSS/XML");
    }

    const parsed = parseXml(xml);
    const rawItems = (parsed.items ?? []) as Array<Record<string, unknown>>;

    const items: RssItem[] = rawItems
      .map((raw) => ({
        title: String(raw.title ?? "").trim(),
        description: cleanArticleText(String(raw.description ?? "").trim()),
        content: cleanArticleText(String(raw.content ?? "").trim()),
        link: String(raw.link ?? "").trim(),
        guid: String(raw.guid ?? raw.link ?? "").trim(),
        pubDate: raw.pubDate instanceof Date ? raw.pubDate : null,
        author: raw.author ? String(raw.author) : null,
      }))
      .filter((item) => item.title && item.link);

    return {
      items,
      feedTitle: String(parsed.title ?? ""),
      feedDescription: String(parsed.description ?? ""),
    };
  } finally {
    clearTimeout(timeout);
  }
}
