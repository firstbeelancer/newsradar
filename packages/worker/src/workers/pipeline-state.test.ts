import { describe, expect, it } from "vitest";
import {
  buildRawDuplicateState,
  isTranslationRecoveryStatus,
  TRANSLATION_RECOVERY_STATUSES,
} from "./pipeline-state.js";

describe("translation pipeline states", () => {
  it("treats raw duplicates as terminal and clears the translation flag", () => {
    const state = buildRawDuplicateState("hash", new Date("2026-08-02T00:00:00Z"));

    expect(state).toMatchObject({
      status: "deduped",
      rawHash: "hash",
      needsTranslation: false,
    });
  });

  it("never sends terminal deduped rows through translation recovery", () => {
    expect(TRANSLATION_RECOVERY_STATUSES).toEqual(["new", "fetched", "translated"]);
    expect(isTranslationRecoveryStatus("deduped")).toBe(false);
    expect(isTranslationRecoveryStatus("fetched")).toBe(true);
  });
});
