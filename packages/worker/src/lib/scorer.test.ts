import { describe, expect, it } from "vitest";
import {
  analyzeKeywordMatch,
  calculateAIScore,
  calculateHybridScore,
  computeRelevanceCap,
  DEFAULT_AI_WEIGHTS,
  HYBRID_WEIGHTS,
} from "./scorer.js";

describe("analyzeKeywordMatch", () => {
  it("does not match short tags inside unrelated words", () => {
    const result = analyzeKeywordMatch(
      "HSE готовит руководство по использованию роботов совместно с людьми",
      "",
      "",
      ["пол", "сп"]
    );

    expect(result.matchedKeywords).toEqual([]);
    expect(result.matchedCount).toBe(0);
    expect(result.score).toBe(0);
  });

  it("matches short tags as standalone terms", () => {
    const result = analyzeKeywordMatch(
      "Обновлены требования СП: пол и монтаж",
      "",
      "",
      ["пол", "сп"]
    );

    expect(result.matchedKeywords).toEqual(["пол", "сп"]);
    expect(result.matchedCount).toBe(2);
  });
});

describe("computeRelevanceCap", () => {
  // Tiered cap: чем больше тегов у агента и чем меньше совпадений,
  // тем жёстче ограничение. Это держит оффтоп-статьи подальше от топа ленты.

  it("не применяется, если keywords нет вообще (0 totalKeywords)", () => {
    expect(computeRelevanceCap(0, 0)).toBeUndefined();
  });

  it("не применяется, если есть хотя бы одно совпадение", () => {
    expect(computeRelevanceCap(10, 1)).toBeUndefined();
    expect(computeRelevanceCap(1, 1)).toBeUndefined();
  });

  it("жёсткий cap 20 для агентов с 5+ тегами и 0 совпадений", () => {
    expect(computeRelevanceCap(5, 0)).toBe(20);
    expect(computeRelevanceCap(20, 0)).toBe(20);
  });

  it("средний cap 35 для агентов с 2-4 тегами и 0 совпадений", () => {
    expect(computeRelevanceCap(2, 0)).toBe(35);
    expect(computeRelevanceCap(4, 0)).toBe(35);
  });

  it("мягкий cap 50 для агентов с 1 тегом и 0 совпадений", () => {
    expect(computeRelevanceCap(1, 0)).toBe(50);
  });
});

describe("calculateAIScore (матрица весов агента)", () => {
  const scores = { relevance: 100, novelty: 0, hype: 0, practical: 0, local: 0 };

  it("применяет веса агента, а не равное усреднение", () => {
    const relevanceHeavy = calculateAIScore(scores, {
      relevance: 80,
      novelty: 5,
      hype: 5,
      practical: 5,
      local: 5,
    });
    const relevanceLight = calculateAIScore(scores, {
      relevance: 5,
      novelty: 80,
      hype: 5,
      practical: 5,
      local: 5,
    });

    expect(relevanceHeavy).toBe(80);
    expect(relevanceLight).toBe(5);
  });

  it("нормализует по сумме весов, даже если она не равна 100", () => {
    expect(
      calculateAIScore(scores, {
        relevance: 8,
        novelty: 1,
        hype: 1,
        practical: 0,
        local: 0,
      })
    ).toBe(80);
  });

  it("возвращает нейтральные 50 при нулевой сумме весов", () => {
    expect(
      calculateAIScore(scores, { relevance: 0, novelty: 0, hype: 0, practical: 0, local: 0 })
    ).toBe(50);
  });

  it("дефолтная матрица весов суммируется в 100%", () => {
    const total =
      DEFAULT_AI_WEIGHTS.relevance +
      DEFAULT_AI_WEIGHTS.novelty +
      DEFAULT_AI_WEIGHTS.hype +
      DEFAULT_AI_WEIGHTS.practical +
      DEFAULT_AI_WEIGHTS.local;

    expect(total).toBe(100);
  });
});

describe("calculateHybridScore", () => {
  it("соблюдает гибридную формулу ai×0.55 + keyword×0.20 + freshness×0.15 + trust×0.10", () => {
    expect(HYBRID_WEIGHTS.ai + HYBRID_WEIGHTS.keyword + HYBRID_WEIGHTS.freshness + HYBRID_WEIGHTS.sourceTrust).toBeCloseTo(1);
    expect(calculateHybridScore(100, 0, 0, 0)).toBe(55);
    expect(calculateHybridScore(0, 100, 0, 0)).toBe(20);
    expect(calculateHybridScore(0, 0, 100, 0)).toBe(15);
    expect(calculateHybridScore(0, 0, 0, 100)).toBe(10);
    expect(calculateHybridScore(100, 100, 100, 100)).toBe(100);
  });
});
