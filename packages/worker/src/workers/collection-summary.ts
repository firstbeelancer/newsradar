export type CollectionResultRow = {
  sourceId?: unknown;
  sourceName?: unknown;
  status?: unknown;
  fetched?: unknown;
  new?: unknown;
  duplicates?: unknown;
  error?: unknown;
};

export type CollectionSourceSummary = {
  sourceId: string;
  sourceName: string;
  status: "success" | "error";
  fetched: number;
  new: number;
  duplicates: number;
  error?: string;
  attempts: number;
};

export type CollectionSummary = {
  sources: CollectionSourceSummary[];
  successCount: number;
  errorCount: number;
  totalNew: number;
  status: "success" | "partial" | "failed";
};

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function summarizeCollectionResults(rows: CollectionResultRow[]): CollectionSummary {
  const bySource = new Map<string, CollectionSourceSummary>();

  for (const row of rows) {
    const sourceId = toStringValue(row.sourceId, "");
    if (!sourceId) continue;

    const previous = bySource.get(sourceId);
    const sourceName = toStringValue(row.sourceName, previous?.sourceName ?? "unknown");
    const rowStatus = row.status === "success" ? "success" : row.status === "error" ? "error" : null;
    if (!rowStatus) continue;

    if (rowStatus === "success") {
      bySource.set(sourceId, {
        sourceId,
        sourceName,
        status: "success",
        fetched: toNumber(row.fetched),
        new: toNumber(row.new),
        duplicates: toNumber(row.duplicates),
        attempts: (previous?.attempts ?? 0) + 1,
      });
      continue;
    }

    if (previous?.status === "success") {
      previous.attempts += 1;
      continue;
    }

    bySource.set(sourceId, {
      sourceId,
      sourceName,
      status: "error",
      fetched: 0,
      new: 0,
      duplicates: 0,
      error: toStringValue(row.error, "Unknown source error"),
      attempts: (previous?.attempts ?? 0) + 1,
    });
  }

  const sources = Array.from(bySource.values());
  const successCount = sources.filter((source) => source.status === "success").length;
  const errorCount = sources.filter((source) => source.status === "error").length;
  const totalNew = sources.reduce((sum, source) => sum + source.new, 0);
  const status = errorCount > 0 && successCount > 0 ? "partial" : errorCount > 0 ? "failed" : "success";

  return {
    sources,
    successCount,
    errorCount,
    totalNew,
    status,
  };
}
