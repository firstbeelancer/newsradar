const FIELD_RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

function parseField(field: string, [min, max]: [number, number]): boolean {
  if (field === "*") return true;

  if (field.includes(",")) {
    return field.split(",").every((f) => parseField(f.trim(), [min, max]));
  }

  if (field.includes("/")) {
    const [base, step] = field.split("/");
    const stepNum = parseInt(step, 10);
    if (!stepNum || stepNum <= 0) return false;
    if (base === "*") return true;
    return parseField(base, [min, max]);
  }

  if (field.includes("-")) {
    const [start, end] = field.split("-").map((f) => parseInt(f, 10));
    if (isNaN(start) || isNaN(end)) return false;
    return start >= min && end <= max && start <= end;
  }

  const num = parseInt(field, 10);
  return !isNaN(num) && num >= min && num <= max;
}

export function isValidCron(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  return parts.every((field, idx) => parseField(field, FIELD_RANGES[idx]));
}

export function validateCron(expression: string): { valid: boolean; reason?: string } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, reason: "Cron expression must have exactly 5 fields" };
  }

  for (let i = 0; i < 5; i++) {
    if (!parseField(parts[i], FIELD_RANGES[i])) {
      const fieldNames = ["minute", "hour", "day of month", "month", "day of week"];
      return { valid: false, reason: `Invalid ${fieldNames[i]} field: "${parts[i]}"` };
    }
  }

  return { valid: true };
}
