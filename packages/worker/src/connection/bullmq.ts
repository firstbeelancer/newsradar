import { Queue, Worker, type Job, type Processor, type WorkerOptions } from "bullmq";
import { redis } from "./redis.js";
import type pino from "pino";

/**
 * Default job options applied to every queue.
 */
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2_000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

/**
 * Default worker concurrency.
 */
const DEFAULT_CONCURRENCY = 5;

/**
 * Create a BullMQ Queue bound to the shared Redis connection.
 *
 * @param name — unique queue identifier
 * @param opts — optional BullMQ queue overrides
 */
export function createQueue(
  name: string,
  opts?: ConstructorParameters<typeof Queue>[1]
): Queue {
  return new Queue(name, {
    connection: redis,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
    ...opts,
  });
}

/**
 * Create a BullMQ Worker bound to the shared Redis connection.
 *
 * @param name — queue name this worker consumes from
 * @param processor — job handler function
 * @param opts — optional worker configuration (concurrency, etc.)
 */
export function createWorker<T = unknown, R = unknown>(
  name: string,
  processor: Processor<T, R>,
  opts?: Omit<WorkerOptions, "connection">
): Worker<T, R> {
  return new Worker<T, R>(name, processor, {
    connection: redis,
    concurrency: DEFAULT_CONCURRENCY,
    ...opts,
  });
}

/**
 * Attach standard logging to a worker instance.
 *
 * @param worker — BullMQ Worker
 * @param logger — pino logger instance
 */
export function attachWorkerLogging(worker: Worker, logger: pino.Logger): void {
  worker.on("completed", (job: Job) => {
    logger.info(
      { jobId: job.id, queue: worker.name, duration: job.finishedOn! - job.processedOn! },
      "Job completed"
    );
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    logger.warn(
      { jobId: job?.id ?? "unknown", queue: worker.name, err: err.message },
      "Job failed"
    );
  });

  worker.on("error", (err: Error) => {
    logger.error({ err: err.message, queue: worker.name }, "Worker error");
  });
}
