export function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (lowerKeyword.length < 2 || seen.has(lowerKeyword)) continue;
    seen.add(lowerKeyword);
    normalized.push(lowerKeyword);
  }

  return normalized;
}

/**
 * Extract keywords from an agent's name and description.
 */
export function extractKeywords(topic: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "must", "shall", "can", "need", "dare", "ought", "used", "about", "into", "through",
    "during", "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "where", "when",
    "why", "how", "all", "each", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "и", "в", "не", "на", "с", "что", "а", "по", "для", "о", "к", "от", "за", "из",
    "до", "при", "после", "но", "или", "так", "как", "его", "ее", "их", "то", "же",
    "бы", "быть", "был", "была", "было", "они", "мы", "вы", "он", "она", "оно",
  ]);

  return topic
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}
