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
import { normalizeChipModifier } from "./chip-modifiers.js";
export { extractKeywords, normalizeKeywords } from "./keywords.js";
import { extractKeywords, normalizeKeywords } from "./keywords.js";
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
  keywordMatches: number;
  keywordTotal: number;
  matchedKeywords: string[];
  freshnessScore: number;
  sourceTrustScore: number;
  overallScore: number;
  baseScore: number;
  chipModifierTotal: number;
  weightedScore: number;
  chips: string[];
  aiFallbackUsed: boolean;
  aiFallbackReason?: string;
  relevanceCap?: number;
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
 *
 * Промт-структура соответствует OpenAI/Anthropic conventions:
 *   - system: persona + формат ответа (всё, что описывает «кто ты» и «как отвечать»)
 *   - user:   конкретные данные для оценки (заголовок, тело, критерии)
 * Раньше user промт начинался с «You are a news scoring assistant for a…»,
 * что дублировало system и сбивало модель с толку в длинных сессиях.
 */
export async function scoreWithAI(
  title: string,
  description: string,
  content: string,
  workspaceId: string,
  agentTopic?: string,
  agentTone?: string,
  logger?: Logger
): Promise<{ scores: AIScores; fallbackUsed: boolean; fallbackReason?: string }> {
  const topic = agentTopic ?? "news and current events";
  const tone = agentTone ?? "professional";
  const body = buildScoringBody(description, content);

  const systemPrompt = `You are a news scoring assistant for the "${topic}" channel (tone: ${tone}).

Your job is to score one news article against 5 criteria, each 0–100:
1. relevance — how well it matches the topic "${topic}" and its audience
2. novelty — how fresh; does it repeat old news
3. hype — potential for discussion, shares, interest
4. practical — actionable / useful for work
5. local — how relevant for a Russian-speaking audience

Hard rules for relevance:
- If NONE of the channel tags/topics appear in the article (title or body), relevance MUST be 0–15. Off-topic news is off-topic even if the article is interesting.
- If only 1 tag/topic matches tangentially (e.g. the article mentions "AI" but the channel is "DevOps & infrastructure"), relevance MUST be ≤ 35.
- If 2–3 tags/topics match, relevance 40–70.
- If the article is squarely on the channel's main topic AND matches several tags, relevance 75–100.
- The word "agent" alone (in "AI agent", "user agent", "AgentLoop" etc.) does NOT make an article relevant to a DevOps / infrastructure channel. You must verify the *kind* of agent (AI/software agent vs ops/infrastructure automation agent).
- A high relevance for a slightly interesting off-topic article is worse than a low relevance for an on-topic one. The channel owner has explicitly tagged what they want; respect that.

Respond with ONLY a JSON object and nothing else, no prose, no markdown:
{"relevance":N,"novelty":N,"hype":N,"practical":N,"local":N}

Each N must be an integer 0–100. The first character of your reply must be '{' and the last must be '}'.`;

  const userPrompt = `Article title: ${title}

Article body:
${body || "(no body provided)"}

Score this article. JSON only.`;

  try {
    const response = await complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      workspaceId,
      process: "scoring",
      temperature: 0.1,
      maxTokens: 80,
      onProviderResolved: (info) => {
        logger?.info(
          {
            process: "scoring",
            provider: info.provider,
            model: info.model,
            source: info.source,
            title,
          },
          "Scoring AI provider resolved",
        );
      },
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

export interface KeywordMatchStats {
  score: number;
  matchedCount: number;
  totalKeywords: number;
  matchedKeywords: string[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordRegex(keyword: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(keyword)}(?![\\p{L}\\p{N}])`, "gu");
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
  return analyzeKeywordMatch(title, description, content, keywords).score;
}

export function analyzeKeywordMatch(
  title: string,
  description: string,
  content: string,
  keywords: string[]
): KeywordMatchStats {
  const normalizedKeywords = normalizeKeywords(keywords);
  if (!normalizedKeywords.length) {
    return { score: 50, matchedCount: 0, totalKeywords: 0, matchedKeywords: [] };
  }

  const text = `${title} ${buildScoringBody(description, content)}`.toLowerCase();
  let matchedCount = 0;
  const matchedKeywords: string[] = [];

  for (const lowerKeyword of normalizedKeywords) {
    const regex = keywordRegex(lowerKeyword);
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      matchedCount++;
      matchedKeywords.push(lowerKeyword);
    }
  }

  if (matchedCount === 0) {
    return { score: 0, matchedCount, totalKeywords: normalizedKeywords.length, matchedKeywords };
  }

  const matchRatio = matchedCount / normalizedKeywords.length;
  return {
    score: Math.min(100, Math.round(35 + matchRatio * 65)),
    matchedCount,
    totalKeywords: normalizedKeywords.length,
    matchedKeywords,
  };
}

/* ─── 2.5 Relevance cap (pure function) ─── */

/**
 * Tiered relevance cap, exported as a pure function for unit testing.
 * If the agent has explicit keywords and NONE match the article, the article
 * is treated as off-topic and the final weighted score is clamped to a small
 * value so it doesn't bubble to the top of the feed.
 *
 *   - totalKeywords >= 5 and 0 matches → cap 20 (the agent has a clear theme)
 *   - totalKeywords >= 2 and 0 matches → cap 35 (smaller tag set, allow more wiggle)
 *   - 1 tag and 0 matches               → cap 50 (very thin tag set)
 *   - 0 tags                            → undefined (backfill keyword extraction may be noisy)
 */
export function computeRelevanceCap(
  totalKeywords: number,
  matchedCount: number
): number | undefined {
  if (totalKeywords <= 0 || matchedCount > 0) return undefined;
  if (totalKeywords >= 5) return 20;
  if (totalKeywords >= 2) return 35;
  return 50;
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
  baseScore: number,
  ageDays: number
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
    // Date-based operators — pattern holds a number of days.
    // Used by the default «Устаревшее» chip filter (-200) to penalize stale news.
    case "age_days_gt":
      return ageDays > parseDecimal(filter.pattern);
    case "age_days_gte":
      return ageDays >= parseDecimal(filter.pattern);
    case "age_days_lt":
      return ageDays < parseDecimal(filter.pattern);
    case "age_days_lte":
      return ageDays <= parseDecimal(filter.pattern);
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
    publishedAt: Date | null;
  },
  baseScore: number,
  sourceTrustScore: number
): Promise<{
  chips: string[];
  triggeredChips: ScoreResult["triggeredChips"];
  chipModifierTotal: number;
}> {
  const activeFilters = await loadAgentChipFilters(article.agentId);

  // Compute age in days (TZ §2.8: «Новости хранятся 3 дня, затем удаляются, кроме избранных»).
  // Articles without pubDate get age 0 — date-based filters won't trigger.
  const ageMs = article.publishedAt ? Date.now() - article.publishedAt.getTime() : 0;
  const ageDays = article.publishedAt ? Math.max(0, ageMs / (1000 * 60 * 60 * 24)) : 0;

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
    .filter((filter) => matchesChipFilter(filter, normalizedText, normalizedTitle, baseScore, ageDays))
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
    workspaceId: string;
    agentTopic?: string;
    agentTone?: string;
    keywords?: string[];
    weights?: AIWeights;
    logger?: Logger;
  }
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
      options.workspaceId,
      options.agentTopic,
      options.agentTone,
      options.logger
    ),
    scoreSourceTrust(article.sourceId),
  ]);

  const keywordStats = analyzeKeywordMatch(
    article.title,
    article.description ?? "",
    article.content ?? "",
    keywords
  );
  const keywordScore = keywordStats.score;

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
      publishedAt: article.publishedAt,
    },
    baseScore,
    sourceTrustScore
  );

  // Hard cap: if the agent has explicit keywords and NONE of them match the
  // article, the article is off-topic for this agent. We cap the final weighted
  // score to keep such articles out of the top of the feed.
  //
  // Tiered by how strict we want to be:
  //   - totalKeywords >= 5 and 0 matches → cap 20 (the agent has a clear theme)
  //   - totalKeywords >= 2 and 0 matches → cap 35 (smaller tag set, allow more wiggle)
  //   - 1 tag and 0 matches               → cap 50 (very thin tag set)
  //   - 0 tags                            → no cap (backfill keyword extraction may be noisy)
  //
  // Это закрывает ситуацию, когда AI стаставит relevance 75+ на чуждой теме
  // (например, «AI agent» в ленте DevOps-агента), и статья проходит в топ.
  const relevanceCap = computeRelevanceCap(
    keywordStats.totalKeywords,
    keywordStats.matchedCount,
  );

  const uncappedWeightedScore = clampScore(baseScore + chipModifierTotal);
  const weightedScore = relevanceCap === undefined
    ? uncappedWeightedScore
    : clampScore(Math.min(uncappedWeightedScore, relevanceCap));

  // Overall = simple average for reference
  const overallScore =
    Math.round(((aiScore + keywordScore + freshnessScore + sourceTrustScore) / 4) * 10) / 10;

  return {
    aiScores,
    aiScore,
    keywordScore,
    keywordMatches: keywordStats.matchedCount,
    keywordTotal: keywordStats.totalKeywords,
    matchedKeywords: keywordStats.matchedKeywords,
    freshnessScore,
    sourceTrustScore,
    overallScore,
    baseScore,
    chipModifierTotal,
    weightedScore,
    chips,
    aiFallbackUsed,
    aiFallbackReason,
    relevanceCap,
    triggeredChips,
  };
}
