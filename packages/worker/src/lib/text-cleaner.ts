const ARTICLE_META_LINE_PATTERNS = [
  /^Article URL:/i,
  /^Comments URL:/i,
  /^Points:/i,
  /^# Comments:/i,
];

const INLINE_META_MARKERS = /\s+(Article URL:|Comments URL:|Points:|# Comments:)/gi;

export function stripHtml(text: string): string {
  if (!text) return "";

  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&laquo;/g, '"')
    .replace(/&raquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Habr and others prefix already-Russian posts with editorial tags. */
const EDITORIAL_TITLE_PREFIX_RE =
  /^\s*[\[(]?\s*(?:перевод|переведено|translation|translated|перевод\s+статьи)\s*[\])]?\s*[:\-–—]?\s*/i;

export function stripEditorialTitlePrefix(title: string): string {
  if (!title) return "";
  let cleaned = title.trim();
  // Repeat in case of nested tags like "[Перевод] [Update] ..."
  for (let i = 0; i < 3; i += 1) {
    const next = cleaned.replace(EDITORIAL_TITLE_PREFIX_RE, "").trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

export function cleanArticleText(text: string): string {
  const stripped = stripHtml(text);
  if (!stripped) return "";

  const normalized = stripped.replace(INLINE_META_MARKERS, "\n$1");

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const meaningfulLines = lines.filter(
    (line) => !ARTICLE_META_LINE_PATTERNS.some((pattern) => pattern.test(line))
  );

  if (meaningfulLines.length === 0) {
    return "";
  }

  return meaningfulLines.join(" ").replace(/\s+/g, " ").trim();
}
