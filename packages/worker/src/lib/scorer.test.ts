import { describe, expect, it } from "vitest";
import { analyzeKeywordMatch, computeRelevanceCap } from "./scorer.js";

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
