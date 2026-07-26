/**
 * ------------------------------------------------------------------
 * Web Page Parser — scrape news articles from plain HTML pages
 * ------------------------------------------------------------------
 * Extracts article links, titles, descriptions and dates from
 * arbitrary news listing pages (no RSS required).
 *
 * Strategy (in priority order):
 *  1. <article> elements containing <a> with heading text
 *  2. Repeated <li> / <div> blocks with <a href> + heading tags
 *  3. Fallback: all <a> links that look like article URLs
 *
 * No external dependencies — regex-based HTML extraction.
 * ------------------------------------------------------------------
 */

import { safeFetchText } from "./safe-fetch.js";

export interface WebItem {
  title: string;
  description: string;
  link: string;
  date: Date | null;
  guid: string;
}

export interface WebParseResult {
  items: WebItem[];
  pageTitle?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

function resolveUrl(base: string, href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

/** Parse dates in common formats: DD.MM.YYYY, YYYY-MM-DD, ISO, etc. */
function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const trimmed = str.trim();

  // DD.MM.YYYY (Russian/European)
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO / standard
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/** Extract datetime from <time> element within a block of HTML. */
function extractDate(block: string): Date | null {
  // <time datetime="...">
  const timeAttr = /<time[^>]*datetime=["']([^"']+)["']/i.exec(block);
  if (timeAttr) {
    const d = parseDate(timeAttr[1]);
    if (d) return d;
  }
  // <time>text</time>
  const timeText = /<time[^>]*>([^<]+)<\/time>/i.exec(block);
  if (timeText) {
    const d = parseDate(stripTags(timeText[1]));
    if (d) return d;
  }
  // class="date" or class="...date..." with text
  const dateClass = /class=["'][^"']*date[^"']*["'][^>]*>([^<]+)/i.exec(block);
  if (dateClass) {
    const d = parseDate(stripTags(dateClass[1]));
    if (d) return d;
  }
  return null;
}

/** Check if a URL path looks like an article (not a static asset, nav, etc.) */
function looksLikeArticleUrl(href: string): boolean {
  const path = href.split("?")[0].split("#")[0];
  // Skip assets, anchors, javascript
  if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip|woff2?|ttf)(\?|$)/i.test(path)) return false;
  if (path.startsWith("javascript:") || path.startsWith("mailto:") || path === "#") return false;
  // Should have some path depth or end with .html
  if (path === "/" || path === "") return false;
  return true;
}

// ─── Extraction strategies ─────────────────────────────────────────

interface RawItem {
  title: string;
  description: string;
  link: string;
  date: Date | null;
}

/** Strategy 1: <article> elements */
function extractFromArticles(html: string, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const articleRegex = /<article[\s\S]*?<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[0];

    // Title: prefer heading tags, fallback to first link text
    let title = "";
    const headingMatch = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(block);
    if (headingMatch) {
      const linkInHeading = /<a[^>]*>([\s\S]*?)<\/a>/i.exec(headingMatch[1]);
      title = stripTags(linkInHeading ? linkInHeading[1] : headingMatch[1]);
    }

    // Link: first <a href> in the block
    const linkMatch = /<a[^>]*href=["']([^"']+)["']/i.exec(block);
    const href = linkMatch?.[1];
    if (!href || !looksLikeArticleUrl(href)) continue;

    if (!title && linkMatch) {
      // Get text of the first link
      const linkTextMatch = /<a[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i.exec(block);
      title = linkTextMatch ? stripTags(linkTextMatch[1]) : "";
    }

    if (!title) continue;

    // Description: first <p> that isn't inside a heading
    let description = "";
    const pMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    if (pMatch) {
      description = stripTags(pMatch[1]).slice(0, 500);
    }

    items.push({
      title: title.slice(0, 300),
      description,
      link: resolveUrl(baseUrl, href),
      date: extractDate(block),
    });
  }

  return items;
}

/** Strategy 2: <li> blocks with links and headings */
function extractFromListItems(html: string, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const liRegex = /<li[\s\S]*?<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(html)) !== null) {
    const block = match[0];

    // Must contain a link
    const linkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!linkMatch) continue;
    const href = linkMatch[1];
    if (!looksLikeArticleUrl(href)) continue;

    // Title from heading or link text
    let title = "";
    const headingMatch = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(block);
    if (headingMatch) {
      title = stripTags(headingMatch[1]);
    }
    if (!title) {
      title = stripTags(linkMatch[2]);
    }
    if (!title || title.length < 10) continue;

    // Description
    let description = "";
    const pMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    if (pMatch) {
      description = stripTags(pMatch[1]).slice(0, 500);
    }

    items.push({
      title: title.slice(0, 300),
      description,
      link: resolveUrl(baseUrl, href),
      date: extractDate(block),
    });
  }

  return items;
}

/** Strategy 3: fallback — all article-like links on the page */
function extractFromLinks(html: string, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const seen = new Set<string>();
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = stripTags(match[2]);
    if (!looksLikeArticleUrl(href)) continue;
    if (text.length < 15) continue; // Too short to be a headline

    const resolved = resolveUrl(baseUrl, href);
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    items.push({
      title: text.slice(0, 300),
      description: "",
      link: resolved,
      date: null,
    });
  }

  return items;
}

// ─── Main entry point ──────────────────────────────────────────────

export async function parseWebPage(url: string): Promise<WebParseResult> {
  const { response, text: html } = await safeFetchText(url, {
    timeoutMs: 60_000,
    maxBytes: 5_000_000,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 NewsRadar/1.0",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!html.trim()) {
    throw new Error("Empty page response");
  }

  // Page title
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  const pageTitle = titleMatch ? stripTags(titleMatch[1]) : undefined;

  // Try strategies in order
  let rawItems = extractFromArticles(html, url);
  if (rawItems.length < 3) {
    const liItems = extractFromListItems(html, url);
    if (liItems.length > rawItems.length) rawItems = liItems;
  }
  if (rawItems.length < 3) {
    const linkItems = extractFromLinks(html, url);
    if (linkItems.length > rawItems.length) rawItems = linkItems;
  }

  // Deduplicate by link
  const seen = new Set<string>();
  const items: WebItem[] = [];
  for (const raw of rawItems) {
    if (seen.has(raw.link)) continue;
    seen.add(raw.link);
    items.push({
      title: raw.title,
      description: raw.description,
      link: raw.link,
      date: raw.date,
      guid: raw.link,
    });
  }

  // Sort by date descending (undated last)
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  });

  return { items, pageTitle };
}
