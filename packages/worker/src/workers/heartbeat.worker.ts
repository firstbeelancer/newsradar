import type IORedis from "ioredis";
import type pino from "pino";

/**
 * Heartbeat worker state.
 */
interface HeartbeatState {
  timer: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
}

const state: HeartbeatState = {
  timer: null,
  isRunning: false,
};

const HEARTBEAT_KEY = "newsradar:worker:heartbeat";
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TTL_S = 120;

/**
 * Start the heartbeat loop.
 *
 * Writes `newsradar:worker:heartbeat` to Redis every 30 seconds
 * with a 120-second TTL. This lets monitoring tools detect if
 * the worker process has gone silent.
 *
 * @param redis — shared Redis connection
 * @param logger — pino logger instance
 */
export function startHeartbeat(redis: IORedis, logger: pino.Logger): void {
  if (state.isRunning) {
    logger.warn("Heartbeat already running — skipping start");
    return;
  }

  state.isRunning = true;

  const tick = async (): Promise<void> => {
    try {
      const now = Date.now();
      await redis.set(HEARTBEAT_KEY, now.toString(), "EX", HEARTBEAT_TTL_S);
      logger.debug({ key: HEARTBEAT_KEY, ttl: HEARTBEAT_TTL_S }, "Heartbeat written");
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "Heartbeat write failed"
      );
    }
  };

  // Immediate first tick
  void tick();

  state.timer = setInterval(() => {
    void tick();
  }, HEARTBEAT_INTERVAL_MS);

  logger.info(
    { intervalMs: HEARTBEAT_INTERVAL_MS, ttl: HEARTBEAT_TTL_S },
    "Heartbeat started"
  );
}

/**
 * Stop the heartbeat loop.
 *
 * @param logger — pino logger instance
 */
export function stopHeartbeat(logger: pino.Logger): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.isRunning = false;
  logger.info("Heartbeat stopped");
}

/**
 * Check if the heartbeat is currently active.
 */
export function isHeartbeatRunning(): boolean {
  return state.isRunning;
}
