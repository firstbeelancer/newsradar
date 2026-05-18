/**
 * ------------------------------------------------------------------
 * Scorer — article scoring system (hybrid model v2)
 * ------------------------------------------------------------------
 * Hybrid formula:
 *   final_score = ai_score×0.55 + keyword×0.20 + freshness×0.15 + source_trust×0.10
 *
 * AI score evaluates 5 criteria (0–100):
 *   1. relevance  — matches agent topic and audience
 *   2. novelty    — fresh, not repeating old themes
 *   3. hype       — viral potential, discussion-worthy
 *   4. practical  — actionable, applicable in work
 *   5. local      — relevant for RU/RF audience
 *
 * Then ai_score = weighted average of 5 criteria using agent weights.
 *
 * Plus chips: exclusive, actionable, trending, controversy, verified
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import { sources, articles, agents, chipFilters } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { complete } from "./ai-client.js";
import { cleanArticleText } from "./text-cleaner.js";
import type { Logger } from "pino";

/* ─── Types ─── */

export interface AIWeights {
  relevance: number;
  novelty: number;
  hype: number;
  practical: number;
  local: number;
}

export const DEFAULT_AI_WEIGHTS: AIWeights = {
  relevance: 30,
  novelty: 25,
  hype: 20,
  practical: 15,
  local: 10,
};

/** Hybrid blend weights (fixed) */
export const HYBRID_WEIGHTS = {
  ai: 0.55,
  keyword: 0.20,
  freshness: 0.15,
  sourceTrust: 0.10,
} as const;

export interface AIScores {
  relevance: number;
  novelty: number;
  hype: number;
  practical: number;
  local: number;
}

export interface ScoreResult {
  aiScores: AIScores;
  aiScore: number;
  keywordScore: number;
  freshnessScore: number;
  sourceTrustScore: number;
  overallScore: number;
  baseScore: number;
  chipModifierTotal: number;
  weightedScore: number;
  chips: string[];
  aiFallbackUsed: boolean;
  aiFallbackReason?: string;
  triggeredChips: Array<{
    key: string;
    label: string;
    scoreModifier: number;
    operator: string;
    pattern: string | null;
  }>;
}

/* ─── 1. AI Scoring (5 criteria) ─── */

/**
 * Evaluate article using AI across 5 criteria.
 * Each score is 0–100.
 */
export async function scoreWithAI(
  title: string,
  description: string,
  content: string,
  agentTopic?: string,
  agentTone?: string,
  logger?: Logger
): Promise<{ scores: AIScores; fallbackUsed: boolean; fallbackReason?: string }> {
  const topic = agentTopic ?? "news and current events";
  const tone = agentTone ?? "professional";
  const body = buildScoringBody(description, content);

  const prompt = `You are a news scoring assistant for a "${topic}" channel.
Evaluate the following article on 5 criteria, each 0–100.

Article title: ${title}
Article body:
${body || "N/A"}

Channel tone: ${tone}

Scoring criteria:
1. relevance — How well does this match the topic "${topic}" and its audience?
2. novelty — How fresh and new is this? Does it repeat old news?
3. hype — How likely is this to generate discussion, shares, interest?
4. practical — How actionable or useful is this for work/business/tech?
5. local — How relevant is this for a Russian-speaking audience?

Respond with ONLY a JSON object, no other text:
{"relevance":N,"novelty":N,"hype":N,"practical":N,"local":N}

Each value must be an integer 0–100.`;

  try {
    const response = await complete({
      messages: [
        {
          role: "system",
          content:
            'You are a scoring assistant. Respond with only a JSON object like {"relevance":85,"novelty":70,"hype":60,"practical":40,"local":90}. No other text.',
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 80,
    });

    // Parse JSON from response
    const cleaned = response.trim().replace(/```json\s*|\s*```/g, "");
    const parsed = JSON.parse(cleaned);

    return {
      scores: {
        relevance: clampInt(parsed.relevance, 50),
        novelty: clampInt(parsed.novelty, 50),
        hype: clampInt(parsed.hype, 50),
        practical: clampInt(parsed.practical, 50),
        local: clampInt(parsed.local, 50),
      },
      fallbackUsed: false,
    };
  } catch (error) {
    const fallbackReason = error instanceof Error ? error.message : "unknown scoring error";
    logger?.warn({ fallbackReason, title }, "AI scoring fallback used");
    return {
      scores: { relevance: 50, novelty: 50, hype: 50, practical: 50, local: 50 },
      fallbackUsed: true,
      fallbackReason,
    };
  }
}

function clampInt(val: unknown, fallback: number): number {
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampScore(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val * 10) / 10));
}

function parseDecimal(val: unknown, fallback = 0): number {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  const parsed = Number.parseFloat(String(val ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildScoringBody(description: string, content: string): string {
  const cleanedDescription = cleanArticleText(description ?? "");
  const cleanedContent = cleanArticleText(content ?? "");

  if (cleanedDescription && cleanedContent) {
    if (cleanedContent.includes(cleanedDescription)) {
      return cleanedContent.slice(0, 4_000);
    }
    return `${cleanedDescription}\n\n${cleanedContent}`.slice(0, 4_000);
  }

  return (cleanedDescription || cleanedContent).slice(0, 4_000);
}

function normalizeChipModifier(val: unknown): number {
  const parsed = parseDecimal(val);
  if (Math.abs(parsed) <= 1) {
    return parsed * 100;
  }
  return parsed;
}

/**
 * Calculate AI composite score from 5 criteria using agent weights.
 * Returns 0–100.
 */
export function calculateAIScore(scores: AIScores, weights: AIWeights): number {
  const totalWeight =
    weights.relevance + weights.novelty + weights.hype + weights.practical + weights.local;
  if (totalWeight === 0) return 50;

  const weighted =
    scores.relevance * weights.relevance +
    scores.novelty * weights.novelty +
    scores.hype * weights.hype +
    scores.practical * weights.practical +
    scores.local * weights.local;

  return Math.round((weighted / totalWeight) * 10) / 10;
}

/* ─── 2. Keyword Match ─── */

/**
 * Count keyword occurrences in article text.
 * Returns score 0–100.
 */
export function scoreKeywordMatch(
  title: string,
  description: string,
  content: string,
  keywords: string[]
): number {
  if (!keywords.length) return 50;

  const text = `${title} ${buildScoringBody(description, content)}`.toLowerCase();
  const totalKeywords = keywords.length;
  let matchedCount = 0;

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (lowerKeyword.length < 2) continue;

    const regex = new RegExp(
      lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g"
    );
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      matchedCount++;
    }
  }

  // Normalize: 30 base + up to 70 based on match ratio
  const matchRatio = matchedCount / totalKeywords;
  return Math.min(100, Math.round(30 + matchRatio * 70));
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

/* ─── 3. Freshness ─── */

/**
 * Score article freshness based on publication date.
 * Returns 0–100.
 */
export function scoreFreshness(publishedAt: Date | null): number {
  if (!publishedAt) return 50;

  const now = Date.now();
  const pubTime = publishedAt.getTime();
  const ageMs = now - pubTime;

  if (ageMs < 0) return 100; // Future

  const ageHours = ageMs / (1_000 * 60 * 60);
  const ageDays = ageHours / 24;

  if (ageHours <= 6) return 100;
  if (ageHours <= 24) return 90;
  if (ageDays <= 2) return 70;
  if (ageDays <= 7) return 50;
  if (ageDays <= 30) return 20;
  return 10;
}

/* ─── 4. Source Trust ─── */

/**
 * Score source trust based on historical error rate.
 * Returns 0–100.
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
  if (!row) return 50;

  const { errorCount, fetchCount } = row;
  if (fetchCount === 0) return 80; // New source — assume decent

  const errorRate = errorCount / fetchCount;
  // errorRate 0 → 100, errorRate 1 → 10
  return Math.max(10, Math.round(100 - errorRate * 90));
}

/* ─── Chips ─── */

/**
 * Determine article chips based on content analysis.
 */
export async function determineChips(
  title: string,
  description: string,
  sourceTrust: number
): Promise<string[]> {
  const chips: string[] = [];
  const text = `${title} ${description || ""}`.toLowerCase();

  if (sourceTrust >= 90) {
    chips.push("verified");
  }

  const controversyKeywords = [
    "scandal", "кризис", "коррупция", "задержан", "арест", "обвинение",
    "конфликт", "война", "санкции", "против", "критика", "осуждение",
    "расследование", "нарушение", "крах", "провал", "трагедия",
    "банкротство", "уволен", "отставка", "спор", "полемика",
  ];
  if (controversyKeywords.some((kw) => text.includes(kw))) {
    chips.push("controversy");
  }

  const actionableKeywords = [
    "как", "how to", "guide", "совет", "tip", "инструкция", "шаг",
    "рекомендация", "советуем", "следуйте", "пошаговый", "tutorial",
    "обзор", "анализ", "прогноз", "стратегия", "план",
  ];
  if (actionableKeywords.some((kw) => text.includes(kw))) {
    chips.push("actionable");
  }

  const trendingKeywords = [
    "тренд", "популяр", "viral", "хит", "boom", " record", "рекорд",
    "взлет", "рост", "подорожал", "дефицит", "хайп", "сенсаци",
    "breaking", "срочно", "экстренно", "важно", "топ",
  ];
  if (trendingKeywords.some((kw) => text.includes(kw))) {
    chips.push("trending");
  }

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

type ChipFilterRow = {
  id: string;
  key: string;
  label: string;
  pattern: string | null;
  operator: string;
  scoreModifier: unknown;
};

function splitChipPattern(pattern: string | null): string[] {
  return (pattern ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesChipFilter(
  filter: ChipFilterRow,
  text: string,
  title: string,
  baseScore: number
): boolean {
  const pattern = filter.pattern ?? "";
  const values = splitChipPattern(pattern);

  switch (filter.operator) {
    case "contains":
      return values.some((value) => text.includes(value.toLowerCase()));
    case "not_contains":
      return values.length > 0 && values.every((value) => !text.includes(value.toLowerCase()));
    case "equals":
      return pattern.length > 0 && title === pattern.toLowerCase();
    case "starts_with":
      return pattern.length > 0 && title.startsWith(pattern.toLowerCase());
    case "regex":
      if (!pattern) return false;
      try {
        return new RegExp(pattern, "i").test(text);
      } catch {
        return false;
      }
    case "in":
      return values.some((value) => value.toLowerCase() === title || text.includes(value.toLowerCase()));
    case "gt":
      return baseScore > parseDecimal(filter.pattern);
    case "gte":
      return baseScore >= parseDecimal(filter.pattern);
    case "lt":
      return baseScore < parseDecimal(filter.pattern);
    case "lte":
      return baseScore <= parseDecimal(filter.pattern);
    default:
      return false;
  }
}

async function loadAgentChipFilters(agentId: string): Promise<ChipFilterRow[]> {
  return db
    .select({
      id: chipFilters.id,
      key: chipFilters.key,
      label: chipFilters.label,
      pattern: chipFilters.pattern,
      operator: chipFilters.operator,
      scoreModifier: chipFilters.scoreModifier,
    })
    .from(chipFilters)
    .where(and(eq(chipFilters.agentId, agentId), eq(chipFilters.isActive, true)))
    .orderBy(chipFilters.position);
}

async function resolveChipScoring(
  article: {
    agentId: string;
    title: string;
    description: string | null;
    content: string | null;
  },
  baseScore: number,
  sourceTrustScore: number
): Promise<{
  chips: string[];
  triggeredChips: ScoreResult["triggeredChips"];
  chipModifierTotal: number;
}> {
  const activeFilters = await loadAgentChipFilters(article.agentId);

  if (activeFilters.length === 0) {
    const fallbackChips = await determineChips(
      article.title,
      article.description ?? "",
      sourceTrustScore
    );

    return {
      chips: fallbackChips,
      triggeredChips: fallbackChips.map((chip) => ({
        key: chip,
        label: chip,
        scoreModifier: 0,
        operator: "legacy",
        pattern: null,
      })),
      chipModifierTotal: 0,
    };
  }

  const normalizedTitle = article.title.toLowerCase();
  const normalizedText = `${article.title} ${buildScoringBody(article.description ?? "", article.content ?? "")}`.toLowerCase();
  const triggeredChips = activeFilters
    .filter((filter) => matchesChipFilter(filter, normalizedText, normalizedTitle, baseScore))
    .map((filter) => ({
      key: filter.key,
      label: filter.label,
      scoreModifier: normalizeChipModifier(filter.scoreModifier),
      operator: filter.operator,
      pattern: filter.pattern,
    }));

  return {
    chips: triggeredChips.map((chip) => chip.key),
    triggeredChips,
    chipModifierTotal: Math.round(
      triggeredChips.reduce((sum, chip) => sum + chip.scoreModifier, 0) * 10
    ) / 10,
  };
}

/* ─── Composite scoring ─── */

/**
 * Calculate hybrid score.
 * final = ai×0.55 + keyword×0.20 + freshness×0.15 + source_trust×0.10
 * All inputs are 0–100, output is 0–100.
 */
export function calculateHybridScore(
  aiScore: number,
  keywordScore: number,
  freshnessScore: number,
  sourceTrustScore: number
): number {
  const raw =
    aiScore * HYBRID_WEIGHTS.ai +
    keywordScore * HYBRID_WEIGHTS.keyword +
    freshnessScore * HYBRID_WEIGHTS.freshness +
    sourceTrustScore * HYBRID_WEIGHTS.sourceTrust;

  return clampScore(raw);
}

/**
 * Load agent-specific AI weights from agent config.
 * Falls back to default weights if not configured.
 */
export async function loadAgentWeights(agentId: string): Promise<AIWeights> {
  try {
    const result = await db
      .select({ config: agents.config })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    const agent = result[0];
    const config = (agent?.config as Record<string, unknown>) ?? {};
    const sw = (config.scoringWeights as Record<string, number>) ?? {};

    return {
      relevance: typeof sw.relevance === "number" ? sw.relevance : DEFAULT_AI_WEIGHTS.relevance,
      novelty: typeof sw.novelty === "number" ? sw.novelty : DEFAULT_AI_WEIGHTS.novelty,
      hype: typeof sw.hype === "number" ? sw.hype : DEFAULT_AI_WEIGHTS.hype,
      practical: typeof sw.practical === "number" ? sw.practical : DEFAULT_AI_WEIGHTS.practical,
      local: typeof sw.local === "number" ? sw.local : DEFAULT_AI_WEIGHTS.local,
    };
  } catch {
    return DEFAULT_AI_WEIGHTS;
  }
}

/**
 * Run the full scoring pipeline on an article.
 */
export async function scoreArticle(
  articleId: string,
  options: {
    agentTopic?: string;
    agentTone?: string;
    keywords?: string[];
    weights?: AIWeights;
    logger?: Logger;
  } = {}
): Promise<ScoreResult> {
  const result = await db
    .select({
      title: articles.title,
      description: articles.description,
      content: articles.content,
      publishedAt: articles.publishedAt,
      sourceId: articles.sourceId,
      agentId: articles.agentId,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const article = result[0];
  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Load agent weights if not provided
  const weights = options.weights ?? (await loadAgentWeights(article.agentId));

  // Resolve keywords
  const keywords =
    options.keywords ??
    (options.agentTopic ? extractKeywords(options.agentTopic) : []);

  // Run scoring in parallel
  const [{ scores: aiScores, fallbackUsed: aiFallbackUsed, fallbackReason: aiFallbackReason }, sourceTrustScore] = await Promise.all([
    scoreWithAI(
      article.title,
      article.description ?? "",
      article.content ?? "",
      options.agentTopic,
      options.agentTone,
      options.logger
    ),
    scoreSourceTrust(article.sourceId),
  ]);

  const keywordScore = scoreKeywordMatch(
    article.title,
    article.description ?? "",
    article.content ?? "",
    keywords
  );

  const freshnessScore = scoreFreshness(article.publishedAt);

  // AI composite from 5 criteria
  const aiScore = calculateAIScore(aiScores, weights);

  const baseScore = calculateHybridScore(
    aiScore,
    keywordScore,
    freshnessScore,
    sourceTrustScore
  );

  const { chips, triggeredChips, chipModifierTotal } = await resolveChipScoring(
    {
      agentId: article.agentId,
      title: article.title,
      description: article.description,
      content: article.content,
    },
    baseScore,
    sourceTrustScore
  );

  const weightedScore = clampScore(baseScore + chipModifierTotal);

  // Overall = simple average for reference
  const overallScore =
    Math.round(((aiScore + keywordScore + freshnessScore + sourceTrustScore) / 4) * 10) / 10;

  return {
    aiScores,
    aiScore,
    keywordScore,
    freshnessScore,
    sourceTrustScore,
    overallScore,
    baseScore,
    chipModifierTotal,
    weightedScore,
    chips,
    aiFallbackUsed,
    aiFallbackReason,
    triggeredChips,
  };
}
