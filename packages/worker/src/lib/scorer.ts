/**
 * ------------------------------------------------------------------
 * Scorer — Hybrid 5+4 scoring system
 * ------------------------------------------------------------------
 * 5 AI sub-criteria (each 0-100):
 *   1. relevance  — how relevant to agent topic
 *   2. novelty    — how new/fresh the info is
 *   3. hype       — viral potential
 *   4. practical  — practical utility
 *   5. local      — Russian/local context relevance
 *
 * These 5 criteria get weighted by SUBJECT AREA weights
 * (e.g., cybersecurity: relevance=35, novelty=20, hype=10, practical=25, local=10)
 *
 * Then the overall score uses a hybrid formula:
 *   ai_score = (relevance * w_relevance + novelty * w_novelty + hype * w_hype + practical * w_practical + local * w_local) / totalWeight
 *   final_base_score = ai_score * 0.55 + keyword_score * 0.20 + freshness_score * 0.15 + source_trust_score * 0.10
 *   final_score = clamp(final_base_score + SUM(chip_filter_modifiers), 0, 100)
 *
 * The existing 4 criteria (ai_relevance, keyword_match, freshness, source_trust) stay
 * but are rebalanced with the new 5 AI sub-criteria inside ai_relevance.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { sources, articles, chipFilters } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { complete } from "./ai-client.js";

/* ─── Types ─── */

/** AI sub-criteria weights per subject area (values sum to 100) */
export interface AIScoringWeights {
  relevance: number; // 0-100
  novelty: number;   // 0-100
  hype: number;      // 0-100
  practical: number; // 0-100
  local: number;     // 0-100
}

/** Meta weights for the hybrid formula (values sum to 1.0) */
export interface MetaWeights {
  aiWeight: number;       // default 0.55
  keywordWeight: number;  // default 0.20
  freshnessWeight: number; // default 0.15
  sourceTrustWeight: number; // default 0.10
}

export interface ScoringWeights {
  aiRelevance: number;
  keywordMatch: number;
  freshness: number;
  sourceTrust: number;
}

export const DEFAULT_AI_WEIGHTS: AIScoringWeights = {
  relevance: 30,
  novelty: 25,
  hype: 15,
  practical: 20,
  local: 10,
};

export const DEFAULT_META_WEIGHTS: MetaWeights = {
  aiWeight: 0.55,
  keywordWeight: 0.20,
  freshnessWeight: 0.15,
  sourceTrustWeight: 0.10,
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
  aiRelevance: 0.35,
  keywordMatch: 0.25,
  freshness: 0.20,
  sourceTrust: 0.20,
};

export interface AISubScores {
  relevance: number; // 0-100
  novelty: number;   // 0-100
  hype: number;      // 0-100
  practical: number; // 0-100
  local: number;     // 0-100
}

export interface ScoreResult {
  aiRelevance: number;    // 0-1 (legacy, derived from ai_score/100)
  keywordMatch: number;   // 0-1
  freshness: number;      // 0-1
  sourceTrust: number;    // 0-1
  // New AI sub-criteria (0-100 scale)
  relevance: number;
  novelty: number;
  hype: number;
  practical: number;
  local: number;
  // Composite scores
  aiScore: number;        // 0-100 (weighted AI score)
  overallScore: number;   // 0-1 (simple average of 4 legacy)
  weightedScore: number;  // 0-100 (hybrid formula result)
  chips: string[];
}

/* ─── 1. AI Sub-criteria Scoring ─── */

/**
 * Evaluate article across 5 AI sub-criteria.
 * Each criterion returns a score between 0 and 100.
 */
export async function scoreAISubCriteria(
  title: string,
  description: string,
  agentTopic?: string
): Promise<AISubScores> {
  const topic = agentTopic ?? "news and current events";

  const prompt = `Evaluate the following article across 5 criteria relevant to the topic "${topic}".

Article title: ${title}
Article description: ${description || "N/A"}

Rate each criterion from 0 to 100:
- relevance: How relevant is this article to the topic "${topic}"?
- novelty: How new/fresh is the information? Is this breaking news or a new development?
- hype: What is the viral potential? Would this generate significant discussion?
- practical: How practically useful is this information? Can the reader take action?
- local: How relevant is this to Russian/local context?

Respond with ONLY a JSON object like: {"relevance":85,"novelty":60,"hype":40,"practical":70,"local":30}

Scores:`;

  try {
    const response = await complete({
      messages: [
        {
          role: "system",
          content:
            "You are a content scoring assistant. Evaluate articles across 5 criteria. Respond with ONLY a JSON object containing relevance, novelty, hype, practical, and local scores (0-100 each).",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 200,
    });

    // Try to parse JSON from the response
    const jsonMatch = response.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      return { relevance: 50, novelty: 50, hype: 50, practical: 50, local: 50 };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      relevance: clampScore(parsed.relevance ?? 50),
      novelty: clampScore(parsed.novelty ?? 50),
      hype: clampScore(parsed.hype ?? 50),
      practical: clampScore(parsed.practical ?? 50),
      local: clampScore(parsed.local ?? 50),
    };
  } catch {
    return { relevance: 50, novelty: 50, hype: 50, practical: 50, local: 50 };
  }
}

function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/* ─── 2. Legacy AI Relevance (kept for backward compat) ─── */

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

/* ─── 3. Keyword Match ─── */

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

    const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      matchedCount++;
    }
  }

  const matchRatio = matchedCount / totalKeywords;
  return Math.min(1, 0.3 + matchRatio * 0.7);
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

/* ─── 4. Freshness ─── */

/**
 * Score article freshness based on publication date.
 * Returns 0-1 scale.
 *   today      = 1.0
 *   yesterday  = 0.8
 *   this week  = 0.5
 *   this month = 0.2
 *   older      = 0.1
 */
export function scoreFreshness(publishedAt: Date | null): number {
  if (!publishedAt) return 0.5;

  const now = Date.now();
  const pubTime = publishedAt.getTime();
  const ageMs = now - pubTime;

  if (ageMs < 0) return 1.0;

  const ageHours = ageMs / (1_000 * 60 * 60);
  const ageDays = ageHours / 24;

  if (ageHours <= 24) return 1.0;
  if (ageDays <= 2) return 0.8;
  if (ageDays <= 7) return 0.5;
  if (ageDays <= 30) return 0.2;
  return 0.1;
}

/* ─── 5. Source Trust ─── */

/**
 * Score source trust based on historical error rate.
 * Returns 0-1 scale.
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
  if (fetchCount === 0) return 0.8;

  const errorRate = errorCount / fetchCount;
  return Math.max(0.1, 1.0 - errorRate);
}

/* ─── 6. Chips with DB-driven modifiers ─── */

/**
 * Determine article chips based on content analysis and agent's chip filter definitions.
 * Returns chip keys that match and their score modifiers.
 */
export async function determineChips(
  title: string,
  description: string,
  sourceTrust: number,
  agentId?: string
): Promise<{ chips: string[]; chipModifier: number }> {
  const text = `${title} ${description || ""}`.toLowerCase();
  const matchedChips: string[] = [];
  let chipModifier = 0;

  // Load agent-specific chip filters from DB
  if (agentId) {
    try {
      const dbChips = await db
        .select()
        .from(chipFilters)
        .where(and(eq(chipFilters.agentId, agentId), eq(chipFilters.isActive, true)));

      for (const chip of dbChips) {
        const isMatch = matchChipPattern(text, chip.pattern, chip.operator);
        if (isMatch) {
          matchedChips.push(chip.key);
          chipModifier += Number(chip.scoreModifier) || 0;
        }
      }
    } catch {
      // Table may not have data yet
    }
  }

  // Fallback: built-in chip logic if no agent chips matched
  if (matchedChips.length === 0) {
    // Verified: high source trust (>0.9)
    if (sourceTrust >= 0.9) {
      matchedChips.push("verified");
    }

    // Controversy: polarizing keywords
    const controversyKeywords = [
      "scandal", "кризис", "коррупция", "задержан", "арест", "обвинение",
      "конфликт", "война", "санкции", "против", "критика", "осуждение",
      "расследование", "нарушение", "крах", "провал", "трагедия",
      "банкротство", "уволен", "отставка", "спор", "полемика",
    ];
    if (controversyKeywords.some((kw) => text.includes(kw))) {
      matchedChips.push("controversy");
    }

    // Actionable: how-to, guides, tips
    const actionableKeywords = [
      "как", "how to", "guide", "совет", "tip", "инструкция", "шаг",
      "рекомендация", "советуем", "следуйте", "пошаговый", "tutorial",
      "обзор", "анализ", "прогноз", "стратегия", "план",
    ];
    if (actionableKeywords.some((kw) => text.includes(kw))) {
      matchedChips.push("actionable");
    }

    // Trending: trending keywords
    const trendingKeywords = [
      "тренд", "популяр", "viral", "хит", "boom", " record", "рекорд",
      "взлет", "рост", "подорожал", "дефицит", "хайп", "сенсаци",
      "breaking", "срочно", "экстренно", "важно", "топ",
    ];
    if (trendingKeywords.some((kw) => text.includes(kw))) {
      matchedChips.push("trending");
    }

    // Exclusive: first coverage / breaking
    const exclusiveKeywords = [
      "эксклюзив", "exclusive", "first", "первый", "breaking",
      "срочная новость", "только что", "недавно", "анонс",
      "презентация", "запуск", "новый продукт",
    ];
    if (exclusiveKeywords.some((kw) => text.includes(kw))) {
      matchedChips.push("exclusive");
    }
  }

  return { chips: matchedChips, chipModifier };
}

/**
 * Match text against a chip pattern using the specified operator.
 */
function matchChipPattern(
  text: string,
  pattern: string | null,
  operator: string
): boolean {
  if (!pattern) return false;

  switch (operator) {
    case "contains":
      return text.includes(pattern.toLowerCase());
    case "not_contains":
      return !text.includes(pattern.toLowerCase());
    case "equals":
      return text === pattern.toLowerCase();
    case "starts_with":
      return text.startsWith(pattern.toLowerCase());
    case "regex": {
      try {
        return new RegExp(pattern, "i").test(text);
      } catch {
        return false;
      }
    }
    default:
      return text.includes(pattern.toLowerCase());
  }
}

/* ─── Hybrid scoring formula ─── */

/**
 * Calculate the weighted AI score from 5 sub-criteria.
 * Each sub-criterion is 0-100, weights are percentages that sum to 100.
 * Result is 0-100.
 */
export function calculateAIScore(
  subScores: AISubScores,
  weights: AIScoringWeights = DEFAULT_AI_WEIGHTS
): number {
  const totalWeight = weights.relevance + weights.novelty + weights.hype + weights.practical + weights.local;
  if (totalWeight === 0) return 50;

  const weightedSum =
    subScores.relevance * weights.relevance +
    subScores.novelty * weights.novelty +
    subScores.hype * weights.hype +
    subScores.practical * weights.practical +
    subScores.local * weights.local;

  return weightedSum / totalWeight;
}

/**
 * Calculate the final hybrid score.
 *
 * Formula:
 *   ai_score = weighted average of 5 AI sub-criteria (0-100)
 *   final_base_score = ai_score * ai_weight + keyword_score * 100 * keyword_weight + freshness_score * 100 * freshness_weight + source_trust_score * 100 * source_trust_weight
 *   final_score = clamp(final_base_score + chip_modifiers, 0, 100)
 */
export function calculateHybridScore(
  aiScore: number,        // 0-100
  keywordScore: number,   // 0-1
  freshnessScore: number, // 0-1
  sourceTrustScore: number, // 0-1
  metaWeights: MetaWeights = DEFAULT_META_WEIGHTS,
  chipModifier: number = 0
): number {
  const finalBaseScore =
    aiScore * metaWeights.aiWeight +
    keywordScore * 100 * metaWeights.keywordWeight +
    freshnessScore * 100 * metaWeights.freshnessWeight +
    sourceTrustScore * 100 * metaWeights.sourceTrustWeight;

  return Math.max(0, Math.min(100, finalBaseScore + chipModifier));
}

/**
 * Legacy: Calculate weighted score from individual components (0-1 scale).
 */
export function calculateWeightedScore(
  scores: { aiRelevance: number; keywordMatch: number; freshness: number; sourceTrust: number },
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
 * Run the full scoring pipeline on an article using the hybrid 5+4 model.
 */
export async function scoreArticle(
  articleId: string,
  options: {
    agentTopic?: string;
    keywords?: string[];
    aiWeights?: AIScoringWeights;
    metaWeights?: MetaWeights;
    agentId?: string;
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

  const aiWeights = options.aiWeights ?? DEFAULT_AI_WEIGHTS;
  const metaWeights = options.metaWeights ?? DEFAULT_META_WEIGHTS;

  // Run all scoring criteria in parallel where possible
  const [aiSubScores, aiRelevance, sourceTrust] = await Promise.all([
    scoreAISubCriteria(article.title, article.description ?? "", options.agentTopic),
    scoreAiRelevance(article.title, article.description ?? "", options.agentTopic),
    scoreSourceTrust(article.sourceId),
  ]);

  const keywordMatch = scoreKeywordMatch(
    article.title,
    article.description ?? "",
    keywords
  );

  const freshness = scoreFreshness(article.publishedAt);

  // Calculate AI score from 5 sub-criteria
  const aiScore = calculateAIScore(aiSubScores, aiWeights);

  // Determine chips with modifiers
  const { chips, chipModifier } = await determineChips(
    article.title,
    article.description ?? "",
    sourceTrust,
    options.agentId
  );

  // Calculate hybrid score (0-100)
  const hybridScore = calculateHybridScore(
    aiScore,
    keywordMatch,
    freshness,
    sourceTrust,
    metaWeights,
    chipModifier
  );

  // Legacy weighted score (0-1 scale, for backward compat)
  const { overallScore, weightedScore } = calculateWeightedScore(
    { aiRelevance, keywordMatch, freshness, sourceTrust }
  );

  return {
    aiRelevance,
    keywordMatch,
    freshness,
    sourceTrust,
    // New AI sub-criteria
    relevance: aiSubScores.relevance,
    novelty: aiSubScores.novelty,
    hype: aiSubScores.hype,
    practical: aiSubScores.practical,
    local: aiSubScores.local,
    // Composite scores
    aiScore: Math.round(aiScore * 100) / 100,
    overallScore,
    weightedScore: Math.round(hybridScore * 1000) / 1000, // Store hybrid score as weightedScore (0-100 scale mapped to decimal)
    chips,
  };
}
