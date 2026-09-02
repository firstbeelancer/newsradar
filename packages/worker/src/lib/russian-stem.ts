/**
 * ------------------------------------------------------------------
 * Russian inflection-tolerant keyword matching
 * ------------------------------------------------------------------
 * Agent tags are typed in the nominative singular («атака», «уязвимость»),
 * but articles use every other case and number. Exact word matching therefore
 * missed the overwhelming majority of genuine hits on a Russian-language feed:
 * measured on production, the tag «атака» matched 3 articles while 65 contained
 * some form of it, and «вредонос» matched 1 against 29.
 *
 * Those misses were not cosmetic — an article that matches no tag at all is
 * clamped by the relevance cap, so 165 of 238 articles in the infosec agent sat
 * at exactly 20 points regardless of what the AI thought of them.
 *
 * The approach is deliberately conservative: strip one common inflectional
 * ending, then allow a few trailing Cyrillic letters. Latin and short tags keep
 * exact matching so abbreviations like cve, rce, pam, dlp, sdn stay precise.
 * ------------------------------------------------------------------
 */

/** Common Russian inflectional endings, longest first so the greedy cut wins. */
const RUSSIAN_ENDINGS = [
  "иями",
  "ость",
  "ение",
  "ями",
  "ами",
  "ия",
  "ий",
  "ой",
  "ые",
  "ый",
  "ая",
  "ое",
  "ов",
  "ам",
  "ах",
  "ем",
  "ом",
  "а",
  "я",
  "ы",
  "и",
  "у",
  "ю",
  "е",
  "ь",
  "о",
];

/** Shortest stem we are willing to produce — below this, false positives spike. */
const MIN_STEM_LENGTH = 4;

/** Below this length a tag is treated as an abbreviation and matched exactly. */
const MIN_INFLECTED_LENGTH = 5;

const CYRILLIC_RE = /^[Ѐ-ӿ\s-]+$/;

export function isCyrillicKeyword(keyword: string): boolean {
  return CYRILLIC_RE.test(keyword);
}

/**
 * Cut one inflectional ending off a Russian word.
 * Returns the word unchanged when no ending applies or the stem would be too short.
 */
export function russianStem(word: string): string {
  const lower = word.toLowerCase();

  for (const ending of RUSSIAN_ENDINGS) {
    if (lower.length > ending.length && lower.endsWith(ending)) {
      const stem = lower.slice(0, -ending.length);
      if (stem.length >= MIN_STEM_LENGTH) {
        return stem;
      }
    }
  }

  return lower;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the matcher for one agent tag.
 *
 * Cyrillic tags of at least {@link MIN_INFLECTED_LENGTH} characters match their
 * stem plus up to five trailing Cyrillic letters, which covers the case, number
 * and adjective forms a news article actually uses. Everything else — Latin
 * terms, abbreviations, very short tags — keeps strict word-boundary matching.
 */
export function buildKeywordRegex(keyword: string): RegExp {
  const lower = keyword.toLowerCase().trim();

  if (isCyrillicKeyword(lower) && lower.length >= MIN_INFLECTED_LENGTH) {
    const stem = russianStem(lower);
    return new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegex(stem)}[\\u0400-\\u04FF]{0,5}(?![\\p{L}\\p{N}])`,
      "gu"
    );
  }

  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(lower)}(?![\\p{L}\\p{N}])`, "gu");
}
