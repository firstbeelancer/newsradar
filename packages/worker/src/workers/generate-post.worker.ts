import type { Job } from "bullmq";
import type { Logger } from "pino";
import { processPreparedGeneration, type PreparedGenerationJob } from "./generation-runtime.js";

export type GeneratePostJob = PreparedGenerationJob;

export async function processGeneratePost(
  job: Job<GeneratePostJob>,
  logger: Logger
): Promise<{ postId: string; content: string }> {
  return processPreparedGeneration(job.data, logger);
}
