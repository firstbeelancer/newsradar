import { executeRaw } from "../db/index.js";
import { db } from "../db/index.js";
import { operationLogs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { summarizeCollectionResults } from "./collection-summary.js";

export type CollectionResult = Record<string, unknown> & {
  sourceId: string;
  sourceName: string;
  status: "success" | "error";
};

export async function appendCollectionResult(
  operationId: string,
  result: CollectionResult
): Promise<void> {
  await executeRaw(
    `
      UPDATE operation_logs
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{results}',
        COALESCE(metadata->'results', '[]'::jsonb) || $2::jsonb,
        true
      )
      WHERE id = $1
    `,
    [operationId, JSON.stringify([result])]
  );

  await reconcileFinalizedCollection(operationId);
}

/**
 * Re-derive an operation's summary when a source reports after finalization.
 *
 * Finalization gives up waiting after a bounded number of retries, so a very
 * slow or heavily retried source can land its result once the log is already
 * terminal. The row used to keep the stale summary forever, under-reporting how
 * many sources actually ran or failed. Recomputing on late arrival keeps the
 * journal honest.
 */
async function reconcileFinalizedCollection(operationId: string): Promise<void> {
  const [log] = await db
    .select({ status: operationLogs.status, metadata: operationLogs.metadata })
    .from(operationLogs)
    .where(eq(operationLogs.id, operationId))
    .limit(1);

  // Still running — the finalization job owns the summary.
  if (!log || log.status === "running" || log.status === "pending") return;

  const meta = (log.metadata as Record<string, unknown>) ?? {};
  const results = (meta.results as Array<Record<string, unknown>>) ?? [];
  if (results.length === 0) return;

  const summary = summarizeCollectionResults(results);
  if (summary.status === log.status) return;

  await db
    .update(operationLogs)
    .set({
      status: summary.status,
      message: `Сбор завершён: ${summary.successCount} источников обработано, ${summary.errorCount} источников с ошибками, ${summary.totalNew} новых статей`,
      metadata: { ...meta, results, sourceSummary: summary.sources },
    })
    .where(eq(operationLogs.id, operationId));
}
