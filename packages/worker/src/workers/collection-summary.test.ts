import { describe, expect, it } from "vitest";
import { summarizeCollectionResults } from "./collection-summary.js";

describe("summarizeCollectionResults", () => {
  it("counts repeated retry errors as one failed source", () => {
    const summary = summarizeCollectionResults([
      { sourceId: "a", sourceName: "Broken feed", status: "error", error: "HTTP 404" },
      { sourceId: "a", sourceName: "Broken feed", status: "error", error: "HTTP 404" },
      { sourceId: "a", sourceName: "Broken feed", status: "error", error: "HTTP 404" },
      { sourceId: "b", sourceName: "Good feed", status: "success", fetched: 10, new: 7, duplicates: 3 },
    ]);

    expect(summary.status).toBe("partial");
    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.totalNew).toBe(7);
    expect(summary.sources).toHaveLength(2);
    expect(summary.sources.find((source) => source.sourceId === "a")?.attempts).toBe(3);
  });

  it("treats a source as successful when a retry eventually succeeds", () => {
    const summary = summarizeCollectionResults([
      { sourceId: "a", sourceName: "Flaky feed", status: "error", error: "HTTP 502" },
      { sourceId: "a", sourceName: "Flaky feed", status: "success", fetched: 3, new: 2, duplicates: 1 },
    ]);

    expect(summary.status).toBe("success");
    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(summary.totalNew).toBe(2);
    expect(summary.sources[0]).toMatchObject({
      sourceId: "a",
      status: "success",
      fetched: 3,
      new: 2,
      duplicates: 1,
      attempts: 2,
    });
  });
});
