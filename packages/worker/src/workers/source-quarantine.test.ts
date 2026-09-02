import { describe, expect, it } from "vitest";
import { decideSourceQuarantine, MAX_CONSECUTIVE_SOURCE_ERRORS } from "./source-health.js";

describe("decideSourceQuarantine", () => {
  it("не считает промежуточные попытки BullMQ отдельными сбоями", () => {
    // Один прогон = 3 попытки. Считать их тремя авариями значило бы
    // отключать живой источник после двух неудачных сборов.
    expect(decideSourceQuarantine({ previousStreak: 0, isFinalAttempt: false })).toEqual({
      streak: null,
      quarantine: false,
    });
    expect(decideSourceQuarantine({ previousStreak: 4, isFinalAttempt: false }).quarantine).toBe(
      false
    );
  });

  it("наращивает серию только на терминальном отказе", () => {
    expect(decideSourceQuarantine({ previousStreak: 0, isFinalAttempt: true }).streak).toBe(1);
    expect(decideSourceQuarantine({ previousStreak: 3, isFinalAttempt: true }).streak).toBe(4);
  });

  it("не отключает источник до порога", () => {
    for (let previous = 0; previous < MAX_CONSECUTIVE_SOURCE_ERRORS - 1; previous += 1) {
      expect(
        decideSourceQuarantine({ previousStreak: previous, isFinalAttempt: true }).quarantine
      ).toBe(false);
    }
  });

  it("отключает источник ровно на пороге", () => {
    const decision = decideSourceQuarantine({
      previousStreak: MAX_CONSECUTIVE_SOURCE_ERRORS - 1,
      isFinalAttempt: true,
    });

    expect(decision.streak).toBe(MAX_CONSECUTIVE_SOURCE_ERRORS);
    expect(decision.quarantine).toBe(true);
  });

  it("переживает испорченный отрицательный счётчик", () => {
    expect(decideSourceQuarantine({ previousStreak: -3, isFinalAttempt: true }).streak).toBe(1);
  });

  it("порог оставляет запас на разовые сетевые сбои", () => {
    expect(MAX_CONSECUTIVE_SOURCE_ERRORS).toBeGreaterThanOrEqual(3);
  });
});
