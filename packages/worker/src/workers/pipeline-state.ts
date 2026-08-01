export const TRANSLATION_RECOVERY_STATUSES = ["new", "fetched", "translated"] as const;

export function isTranslationRecoveryStatus(status: string): boolean {
  return (TRANSLATION_RECOVERY_STATUSES as readonly string[]).includes(status);
}

export function buildRawDuplicateState(rawHash: string, updatedAt = new Date()) {
  return {
    status: "deduped" as const,
    rawHash,
    // A raw duplicate is terminal: it must never remain in the translation backlog.
    needsTranslation: false,
    updatedAt,
  };
}
