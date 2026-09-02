import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeRaw, selectRows, updateSet } = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  selectRows: vi.fn(),
  updateSet: vi.fn(),
}));

// The module under test both appends via raw SQL and reads/updates the
// operation log through drizzle, so the mock has to cover both surfaces.
vi.mock("../db/index.js", () => ({
  executeRaw,
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => selectRows(),
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: () => {
          updateSet(values);
          return Promise.resolve([]);
        },
      }),
    }),
  },
}));

vi.mock("../db/schema.js", () => ({ operationLogs: { id: "id", status: "status", metadata: "metadata" } }));

import { appendCollectionResult } from "./collection-results.js";

const result = {
  sourceId: "source-1",
  sourceName: "Example feed",
  status: "success" as const,
  fetched: 10,
  new: 3,
};

describe("appendCollectionResult", () => {
  beforeEach(() => {
    executeRaw.mockReset();
    selectRows.mockReset();
    updateSet.mockReset();
    executeRaw.mockResolvedValue([]);
    selectRows.mockResolvedValue([]);
  });

  it("appends a result atomically inside PostgreSQL", async () => {
    await appendCollectionResult("operation-1", result);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [query, params] = executeRaw.mock.calls[0];
    expect(query).toContain("jsonb_set");
    expect(query).toContain("metadata->'results'");
    expect(params).toEqual(["operation-1", JSON.stringify([result])]);
  });

  it("не трогает сводку, пока операция ещё выполняется", async () => {
    // Пока лог running, сводкой владеет finalize-collection.
    selectRows.mockResolvedValue([{ status: "running", metadata: { results: [result] } }]);

    await appendCollectionResult("operation-1", result);

    expect(updateSet).not.toHaveBeenCalled();
  });

  it("пересчитывает статус, когда источник отчитался после финализации", async () => {
    // Финализатор успел закрыть операцию как success, а медленный источник
    // доехал с ошибкой — статус обязан стать partial, иначе журнал врёт.
    selectRows.mockResolvedValue([
      {
        status: "success",
        metadata: {
          results: [
            { sourceId: "a", sourceName: "A", status: "success", new: 3 },
            { sourceId: "b", sourceName: "B", status: "error", error: "timeout" },
          ],
        },
      },
    ]);

    await appendCollectionResult("operation-1", result);

    expect(updateSet).toHaveBeenCalledTimes(1);
    const values = updateSet.mock.calls[0][0] as { status: string; message: string };
    expect(values.status).toBe("partial");
    expect(values.message).toContain("1 источников с ошибками");
  });

  it("не переписывает лог, если пересчёт дал тот же статус", async () => {
    selectRows.mockResolvedValue([
      {
        status: "partial",
        metadata: {
          results: [
            { sourceId: "a", sourceName: "A", status: "success", new: 3 },
            { sourceId: "b", sourceName: "B", status: "error", error: "timeout" },
          ],
        },
      },
    ]);

    await appendCollectionResult("operation-1", result);

    expect(updateSet).not.toHaveBeenCalled();
  });
});
