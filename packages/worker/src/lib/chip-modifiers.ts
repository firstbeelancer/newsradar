function parseDecimal(val: unknown, fallback = 0): number {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  const parsed = Number.parseFloat(String(val ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeChipModifier(val: unknown): number {
  return parseDecimal(val);
}
