/**
 * ------------------------------------------------------------------
 * Shared bits of the collection dispatch path
 * ------------------------------------------------------------------
 * Both the dashboard ("collect everything") and the agent page
 * ("collect this agent") queue fetch-source jobs and then a delayed
 * finalization job. They used different delays — 120s and 60s — for no
 * reason, so the two entry points reconciled their operation logs on
 * different schedules.
 * ------------------------------------------------------------------
 */

/**
 * How long finalization waits before its first attempt.
 *
 * This is only the opening bid: the worker re-checks whether every source has
 * reported and re-queues itself if not, so a slow source does not get a
 * collection marked complete without it.
 */
export const COLLECTION_FINALIZE_DELAY_MS = 120_000;

/** Resolve the fetch-source queue, kept in one place for both call sites. */
export async function resolveFetchQueue() {
  const { getFetchSourceQueue } = await import("./queues.js");
  return getFetchSourceQueue();
}
