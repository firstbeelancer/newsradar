import { describe, expect, it } from "vitest";
import { normalizeChipModifier } from "./chip-modifiers.js";

describe("normalizeChipModifier", () => {
  it("keeps stored chip modifiers as score points", () => {
    expect(normalizeChipModifier("1.0000")).toBe(1);
    expect(normalizeChipModifier("0.8000")).toBe(0.8);
    expect(normalizeChipModifier("-0.5000")).toBe(-0.5);
    expect(normalizeChipModifier("15.0000")).toBe(15);
  });
});
