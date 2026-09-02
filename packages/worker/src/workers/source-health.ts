/**
 * ------------------------------------------------------------------
 * Source health — quarantine decision for repeatedly failing sources
 * ------------------------------------------------------------------
 * Kept free of DB and queue imports so the rule can be tested directly
 * rather than through a copy of itself.
 * ------------------------------------------------------------------
 */

/**
 * Consecutive failed collection runs before a source is deactivated.
 *
 * Nothing used to take a dead source out of rotation: `error_count` only fed
 * scoreSourceTrust, so a 404 feed burned three attempts with exponential
 * backoff on every run, indefinitely. The source stays in the workspace and can
 * be switched back on from the sources page, which clears the streak.
 */
export const MAX_CONSECUTIVE_SOURCE_ERRORS = 5;

export interface QuarantineDecision {
  /** New streak value, or null when this failure should not be counted. */
  streak: number | null;
  /** Whether the source should be deactivated now. */
  quarantine: boolean;
}

/**
 * Decide what a failed fetch means for a source's health.
 *
 * Only a terminal failure counts: one collection run costs three BullMQ
 * attempts, and counting each of them separately would deactivate a healthy
 * source after two bad runs.
 */
export function decideSourceQuarantine(params: {
  previousStreak: number;
  isFinalAttempt: boolean;
}): QuarantineDecision {
  if (!params.isFinalAttempt) {
    return { streak: null, quarantine: false };
  }

  const streak = Math.max(0, params.previousStreak) + 1;
  return { streak, quarantine: streak >= MAX_CONSECUTIVE_SOURCE_ERRORS };
}
