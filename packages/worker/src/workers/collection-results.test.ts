import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeRaw } = vi.hoisted(() => ({ executeRaw: vi.fn() }));

vi.mock("../db/index.js", () => ({ executeRaw }));

import { appendCollectionResult } from "./collection-results.js";

describe("appendCollectionResult", () => {
  beforeEach(() => {
    executeRaw.mockReset();
    executeRaw.mockResolvedValue([]);
  });

  it("appends a result atomically inside PostgreSQL", async () => {
    const result = {
      sourceId: "source-1",
      sourceName: "Example feed",
      status: "success" as const,
      fetched: 10,
      new: 3,
    };

    await appendCollectionResult("operation-1", result);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [query, params] = executeRaw.mock.calls[0];
    expect(query).toContain("jsonb_set");
    expect(query).toContain("metadata->'results'");
    expect(params).toEqual(["operation-1", JSON.stringify([result])]);
  });
});
