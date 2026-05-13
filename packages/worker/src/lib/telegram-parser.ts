/**
 * ------------------------------------------------------------------
 * Telegram Parser — fetch public Telegram channel posts
 * ------------------------------------------------------------------
 * Parses t.me/s/USERNAME pages using regex-based HTML extraction.
 * No external dependencies (cheerio-like approach with regex).
 * ------------------------------------------------------------------
 */

export interface TelegramItem {
  title: string;
  content: string;
  date: Date | null;
  link: string;
  messageId: string;
}

export interface TelegramParseResult {
  items: TelegramItem[];
  channelTitle?: string;
}

/**
 * Build the t.me/s/USERNAME URL from a channel username or full URL.
 */
function resolveChannelUrl(usernameOrUrl: string): string {
  if (usernameOrUrl.startsWith("http")) {
    // Convert t.me/username to t.me/s/username
    const url = new URL(usernameOrUrl);
    const path = url.pathname.replace(/^\//, "").split("/")[0];
    return `https://t.me/s/${path}`;
  }
  // Strip @ prefix if present
  const username = usernameOrUrl.replace(/^@/, "");
  return `https://t.me/s/${username}`;
}

/**
 * Extract text content from between HTML tags.
 */
function extractText(html: string, tag: string, className?: string): string {
  const classAttr = className ? ` class=["']${className}["']` : "";
  const regex = new RegExp(`<${tag}${classAttr}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = regex.exec(html);
  if (!match) return "";
  // Strip inner HTML tags
  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract channel title from the page.
 */
function extractChannelTitle(html: string): string {
  // Try og:title or page title
  const ogMatch = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html);
  if (ogMatch) return decodeHtmlEntities(ogMatch[1]);

  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  if (titleMatch) {
    const title = decodeHtmlEntities(titleMatch[1]);
    // Telegram titles are "Channel Name"
    return title.replace(/\s*—\s*Telegram$/, "").trim();
  }

  return "";
}

/**
 * Decode HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x2F;": "/",
    "&nbsp;": " ",
  };
  return text.replace(/&[^;]+;/g, (match) => entities[match] ?? match);
}

/**
 * Parse relative Telegram timestamps.
 */
function parseTelegramDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const now = new Date();
  const lower = dateStr.toLowerCase().trim();

  // "today at 12:34"
  const todayMatch = /today at (\d{1,2}):(\d{2})/i.exec(lower);
  if (todayMatch) {
    const date = new Date(now);
    date.setHours(Number(todayMatch[1]), Number(todayMatch[2]), 0, 0);
    return date;
  }

  // "yesterday at 12:34"
  const yesterdayMatch = /yesterday at (\d{1,2}):(\d{2})/i.exec(lower);
  if (yesterdayMatch) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    date.setHours(Number(yesterdayMatch[1]), Number(yesterdayMatch[2]), 0, 0);
    return date;
  }

  // Try ISO or standard date parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

/**
 * Fetch and parse a public Telegram channel page.
 *
 * @param usernameOrUrl — Telegram channel username (@channel) or URL
 * @returns Parsed posts
 */
export async function parseTelegramChannel(
  usernameOrUrl: string
): Promise<TelegramParseResult> {
  const url = resolveChannelUrl(usernameOrUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Telegram channel not found: ${usernameOrUrl}`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    if (!html.includes('class="tgme_widget_message"')) {
      // Check if channel has no posts or is private
      if (html.includes("If you have <strong>Telegram</strong>, you can contact")) {
        throw new Error(`Telegram channel is private or does not exist: ${usernameOrUrl}`);
      }
    }

    const channelTitle = extractChannelTitle(html);
    const items: TelegramItem[] = [];

    // Each message is wrapped in <div class="tgme_widget_message" data-post="channel/123">
    const messageRegex =
      /<div class=["']tgme_widget_message["'][^>]*data-post=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;

    let msgMatch: RegExpExecArray | null;
    while ((msgMatch = messageRegex.exec(html)) !== null) {
      const fullMessage = msgMatch[0];
      const postRef = msgMatch[1]; // channel/123
      const messageId = postRef.split("/")[1] ?? "";

      // Extract text content
      const textWrapMatch =
        /<div class=["']tgme_widget_message_text[^"]*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
          fullMessage
        );
      let content = "";
      if (textWrapMatch) {
        content = decodeHtmlEntities(
          textWrapMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
        ).trim();
      }

      // Extract date
      const timeMatch =
        /<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i.exec(
          fullMessage
        );
      const date = timeMatch?.[1]
        ? new Date(timeMatch[1])
        : timeMatch?.[2]
          ? parseTelegramDate(timeMatch[2])
          : null;

      // Build direct link
      const channelName = postRef.split("/")[0];
      const link = `https://t.me/${channelName}/${messageId}`;

      // Generate title from first line or first 100 chars of content
      const title =
        content.split("\n")[0]?.slice(0, 120) ??
        content.slice(0, 120);

      if (content || title) {
        items.push({
          title: title || "Telegram post",
          content,
          date,
          link,
          messageId,
        });
      }
    }

    // Sort by date descending (newest first)
    items.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return b.date.getTime() - a.date.getTime();
    });

    return { items, channelTitle };
  } finally {
    clearTimeout(timeout);
  }
}
