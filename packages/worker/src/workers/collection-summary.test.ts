import { describe, expect, it } from "vitest";
import { isCollectionReadyToFinalize, summarizeCollectionResults } from "./collection-summary.js";

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

  it("does not finalize until every expected source has a terminal result", () => {
    const results = [
      { sourceId: "a", sourceName: "Good feed", status: "success", fetched: 10, new: 1, duplicates: 9 },
      { sourceId: "b", sourceName: "Broken feed", status: "error", error: "HTTP 404" },
    ];

    expect(isCollectionReadyToFinalize(results, 3)).toBe(false);
    expect(isCollectionReadyToFinalize(results, 2)).toBe(true);
  });
});

describe("поздние результаты после финализации", () => {
  // Финализатор перестаёт ждать после лимита повторов, поэтому очень медленный
  // источник может отчитаться, когда лог уже терминальный. Пересчёт должен
  // менять статус, а не оставлять заниженную сводку.
  it("частичный успех становится провалом, когда доезжает последняя ошибка", () => {
    const early = summarizeCollectionResults([
      { sourceId: "a", sourceName: "A", status: "success", new: 3 },
    ]);
    expect(early.status).toBe("success");

    const late = summarizeCollectionResults([
      { sourceId: "a", sourceName: "A", status: "success", new: 3 },
      { sourceId: "b", sourceName: "B", status: "error", error: "timeout" },
    ]);
    expect(late.status).toBe("partial");
    expect(late.errorCount).toBe(1);
    expect(late.successCount).toBe(1);
  });

  it("сводка идемпотентна: повторный пересчёт тех же строк ничего не меняет", () => {
    const rows = [
      { sourceId: "a", sourceName: "A", status: "success", new: 2 },
      { sourceId: "b", sourceName: "B", status: "error", error: "404" },
    ];

    expect(summarizeCollectionResults(rows)).toEqual(summarizeCollectionResults(rows));
  });
});
