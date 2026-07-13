export interface RssProbeResult {
  validXml: boolean;
  articleCount: number;
  datedArticleCount: number;
}

export function probeRssBody(body: string): RssProbeResult {
  const validXml =
    body.trimStart().startsWith("<?xml") ||
    /<(?:rss|feed|rdf:RDF)\b/i.test(body);
  const articleCount = (body.match(/<(?:item|entry)(?:\s|>)/gi) ?? []).length;
  const datedArticleCount = (
    body.match(/<(?:pubDate|dc:date|prism:publicationDate|published|updated)(?:\s|>)/gi) ?? []
  ).length;
  return { validXml, articleCount, datedArticleCount };
}

export function probeTelegramBody(body: string): number {
  return (body.match(/\btgme_widget_message_wrap\b/g) ?? []).length;
}

export function telegramPreviewUrl(channelUsername: string | null, sourceUrl: string): string {
  const raw = (channelUsername || sourceUrl).trim();
  let username = raw.replace(/^@/, "");
  try {
    const url = new URL(raw);
    username = url.pathname.split("/").filter(Boolean).at(-1) ?? username;
  } catch {
    // Plain channel usernames are valid input.
  }
  username = username.replace(/^s\//, "").replace(/^@/, "");
  return `https://t.me/s/${encodeURIComponent(username)}`;
}
