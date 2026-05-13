/**
 * ------------------------------------------------------------------
 * Scorer — article scoring system
 * ------------------------------------------------------------------
 * 4 scoring criteria:
 *   1. ai_relevance    — AI-evaluated relevance (0–1)
 *   2. keyword_match   — keyword occurrences from agent topic
 *   3. freshness       — recency of publication
 *   4. source_trust    — inverse of source error rate
 *
 * Plus chips: exclusive, actionable, trending, controversy, verified
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { sources, articles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { complete } from "./ai-client.js";

/* ─── Types ─── */

export interface ScoringWeights {
  aiRelevance: number;
  keywordMatch: number;
  freshness: number;
  sourceTrust: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  aiRelevance: 0.35,
  keywordMatch: 0.25,
  freshness: 0.20,
  sourceTrust: 0.20,
};

export interface ScoreResult {
  aiRelevance: number;
  keywordMatch: number;
  freshness: number;
  sourceTrust: number;
  overallScore: number;
  weightedScore: number;
  chips: string[];
}

/* ─── 1. AI Relevance ─── */

/**
 * Evaluate article relevance using AI.
 * Returns a score between 0 and 1.
 */
export async function scoreAiRelevance(
  title: string,
  description: string,
  agentTopic?: string
): Promise<number> {
  const topic = agentTopic ?? "news and current events";

  const prompt = `Evaluate how relevant the following article is to the topic "${topic}".

Article title: ${title}
Article description: ${description || "N/A"}

Respond with ONLY a number from 0.00 to 1.00, where:
- 1.00 = highly relevant, directly about the topic
- 0.50 = moderately relevant, tangentially related
- 0.00 = completely irrelevant

Score:`;

  try {
    const response = await complete({
      messages: [
        {
          role: "system",
          content:
            "You are a relevance scoring assistant. Respond with only a decimal number between 0.00 and 1.00.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 10,
    });

    const score = parseFloat(response.trim());
    if (isNaN(score)) return 0.5;
    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5; // Fallback on error
  }
}

/* ─── 2. Keyword Match ─── */

/**
 * Count keyword occurrences in article text.
 * Returns normalized score 0–1 based on keyword density.
 */
export function scoreKeywordMatch(
  title: string,
  description: string,
  keywords: string[]
): number {
  if (!keywords.length) return 0.5;

  const text = `${title} ${description || ""}`.toLowerCase();
  const totalKeywords = keywords.length;
  let matchedCount = 0;

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (lowerKeyword.length < 2) continue;

    // Count occurrences
    const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      matchedCount++;
    }
  }

  // Normalize: 0.3 base + up to 0.7 based on match ratio
  const matchRatio = matchedCount / totalKeywords;
  return Math.min(1, 0.3 + matchRatio * 0.7);
}

/**
 * Extract keywords from an agent's name and description.
 * Simple word-tokenization approach.
 */
export function extractKeywords(topic: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "must", "shall", "can", "need", "dare", "ought", "used", "about", "into", "through",
    "during", "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when", "where",
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

/* ─── 3. Freshness ─── */

/**
 * Score article freshness based on publication date.
 *   today      = 1.0
 *   yesterday  = 0.8
 *   this week  = 0.5
 *   this month = 0.2
 *   older      = 0.1
 */
export function scoreFreshness(publishedAt: Date | null): number {
  if (!publishedAt) return 0.5; // Unknown date gets middle score

  const now = Date.now();
  const pubTime = publishedAt.getTime();
  const ageMs = now - pubTime;

  // Future articles get full score
  if (ageMs < 0) return 1.0;

  const ageHours = ageMs / (1_000 * 60 * 60);
  const ageDays = ageHours / 24;

  if (ageHours <= 24) return 1.0; // Today
  if (ageDays <= 2) return 0.8; // Yesterday
  if (ageDays <= 7) return 0.5; // This week
  if (ageDays <= 30) return 0.2; // This month
  return 0.1; // Older
}

/* ─── 4. Source Trust ─── */

/**
 * Score source trust based on historical error rate.
 * High error_count → lower trust.
 */
export async function scoreSourceTrust(sourceId: string): Promise<number> {
  const result = await db
    .select({
      errorCount: sources.errorCount,
      fetchCount: sources.fetchCount,
    })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);

  const row = result[0];
  if (!row) return 0.5;

  const { errorCount, fetchCount } = row;
  if (fetchCount === 0) return 0.8; // New source — assume decent

  const errorRate = errorCount / fetchCount;
  // errorRate 0 → 1.0, errorRate 1 → 0.1
  return Math.max(0.1, 1.0 - errorRate);
}

/* ─── Chips ─── */

/**
 * Determine article chips based on content analysis.
 *
 * Chips:
 *   - exclusive    — breaking news, first coverage
 *   - actionable   — contains actionable advice
 *   - trending     — high-velocity topic
 *   - controversy  — polarizing topic
 *   - verified     — from high-trust source
 */
export async function determineChips(
  title: string,
  description: string,
  sourceTrust: number
): Promise<string[]> {
  const chips: string[] = [];
  const text = `${title} ${description || ""}`.toLowerCase();

  // Verified: high source trust (>0.9) and no error history
  if (sourceTrust >= 0.9) {
    chips.push("verified");
  }

  // Controversy: polarizing keywords
  const controversyKeywords = [
    "scandal", "кризис", "коррупция", "задержан", "арест", "обвинение",
    "конфликт", "война", "санкции", "против", "критика", "осуждение",
    "расследование", "нарушение", "крах", "крах", "провал", "трагедия",
    "банкротство", "уволен", "отставка", "спор", "полемика",
  ];
  if (controversyKeywords.some((kw) => text.includes(kw))) {
    chips.push("controversy");
  }

  // Actionable: how-to, guides, tips
  const actionableKeywords = [
    "как", "how to", "guide", "совет", "tip", "инструкция", "шаг",
    "рекомендация", "советуем", "следуйте", "пошаговый", "tutorial",
    "обзор", "анализ", "прогноз", "стратегия", "план",
  ];
  if (actionableKeywords.some((kw) => text.includes(kw))) {
    chips.push("actionable");
  }

  // Trending: trending keywords
  const trendingKeywords = [
    "тренд", "популяр", "viral", "хит", "boom", " record", "рекорд",
    "взлет", "рост", "подорожал", "дефицит", "хайп", "сенсаци",
    "breaking", "срочно", "экстренно", "важно", "топ",
  ];
  if (trendingKeywords.some((kw) => text.includes(kw))) {
    chips.push("trending");
  }

  // Exclusive: first coverage / breaking
  const exclusiveKeywords = [
    "эксклюзив", "exclusive", "first", "первый", "breaking",
    "срочная новость", "только что", "недавно", "анонс",
    "презентация", "запуск", "новый продукт",
  ];
  if (exclusiveKeywords.some((kw) => text.includes(kw))) {
    chips.push("exclusive");
  }

  return chips;
}

/* ─── Composite scoring ─── */

/**
 * Calculate weighted score from individual components.
 */
export function calculateWeightedScore(
  scores: Omit<ScoreResult, "overallScore" | "weightedScore" | "chips">,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): { overallScore: number; weightedScore: number } {
  const overallScore =
    (scores.aiRelevance + scores.keywordMatch + scores.freshness + scores.sourceTrust) / 4;

  const weightedScore =
    scores.aiRelevance * weights.aiRelevance +
    scores.keywordMatch * weights.keywordMatch +
    scores.freshness * weights.freshness +
    scores.sourceTrust * weights.sourceTrust;

  return {
    overallScore: Math.round(overallScore * 1_000) / 1_000,
    weightedScore: Math.round(weightedScore * 1_000) / 1_000,
  };
}

/**
 * Run the full scoring pipeline on an article.
 */
export async function scoreArticle(
  articleId: string,
  options: {
    agentTopic?: string;
    keywords?: string[];
    weights?: ScoringWeights;
  } = {}
): Promise<ScoreResult> {
  // Fetch article data
  const result = await db
    .select({
      title: articles.title,
      description: articles.description,
      publishedAt: articles.publishedAt,
      sourceId: articles.sourceId,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Resolve keywords
  const keywords =
    options.keywords ??
    (options.agentTopic ? extractKeywords(options.agentTopic) : []);

  const weights = options.weights ?? DEFAULT_WEIGHTS;

  // Run all scoring criteria in parallel where possible
  const [aiRelevance, sourceTrust] = await Promise.all([
    scoreAiRelevance(article.title, article.description ?? "", options.agentTopic),
    scoreSourceTrust(article.sourceId),
  ]);

  const keywordMatch = scoreKeywordMatch(
    article.title,
    article.description ?? "",
    keywords
  );

  const freshness = scoreFreshness(article.publishedAt);

  const chips = await determineChips(
    article.title,
    article.description ?? "",
    sourceTrust
  );

  const { overallScore, weightedScore } = calculateWeightedScore(
    { aiRelevance, keywordMatch, freshness, sourceTrust },
    weights
  );

  return {
    aiRelevance,
    keywordMatch,
    freshness,
    sourceTrust,
    overallScore,
    weightedScore,
    chips,
  };
}
