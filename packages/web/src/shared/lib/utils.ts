import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const ARTICLE_META_LINE_PATTERNS = [
  /^Article URL:/i,
  /^Comments URL:/i,
  /^Points:/i,
  /^# Comments:/i,
];

const INLINE_META_MARKERS = /\s+(Article URL:|Comments URL:|Points:|# Comments:)/gi;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'Дата не указана';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 'Дата не указана';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/** Strip HTML tags from text (for legacy articles that contain HTML). */
export function stripHtml(text: string): string {
  if (!text) return '';

  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&laquo;/g, '"')
    .replace(/&raquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanArticleText(text: string): string {
  const stripped = stripHtml(text);
  if (!stripped) return '';

  const normalized = stripped.replace(INLINE_META_MARKERS, '\n$1');

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const meaningfulLines = lines.filter(
    (line) => !ARTICLE_META_LINE_PATTERNS.some((pattern) => pattern.test(line))
  );

  if (meaningfulLines.length === 0) {
    return '';
  }

  return meaningfulLines.join(' ').replace(/\s+/g, ' ').trim();
}

/** Strip Habr-style editorial tags like «[Перевод]» from titles for display. */
export function stripEditorialTitlePrefix(title: string): string {
  if (!title) return '';
  let cleaned = title.trim();
  const re =
    /^\s*[\[(]?\s*(?:перевод|переведено|translation|translated|перевод\s+статьи)\s*[\])]?\s*[:\-–—]?\s*/i;
  for (let i = 0; i < 3; i += 1) {
    const next = cleaned.replace(re, '').trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}
