import { describe, expect, it } from "vitest";
import { analyzeKeywordMatch } from "./scorer.js";

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
