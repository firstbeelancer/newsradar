import type { Job } from "bullmq";
import type { Logger } from "pino";
import { processPreparedGeneration, type PreparedGenerationJob } from "./generation-runtime.js";

export type GenerateDigestJob = PreparedGenerationJob;

export async function processGenerateDigest(
  job: Job<GenerateDigestJob>,
  logger: Logger
): Promise<{ postId: string; content: string }> {
  return processPreparedGeneration(job.data, logger);
}
