import { executeRaw } from "../db/index.js";

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
}
