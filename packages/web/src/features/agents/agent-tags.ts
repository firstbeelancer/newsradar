import type { CreateAgentDto, UpdateAgentDto } from '@shared/api/client';

export function buildAgentTags(existingTags: string[], pendingInput: string): string[] {
  const merged = [...existingTags, ...splitTagInput(pendingInput)];
  const byKey = new Map<string, string>();

  for (const tag of merged) {
    const normalized = normalizeAgentTag(tag);
    if (normalized && !byKey.has(normalized)) {
      byKey.set(normalized, normalized);
    }
  }

  return [...byKey.values()];
}

export function buildSettingsAgentCreatePayload(
  data: CreateAgentDto | UpdateAgentDto,
  position: number
): CreateAgentDto {
  return {
    ...(data as CreateAgentDto),
    name: (data.name ?? '').trim(),
    position,
  };
}

function splitTagInput(input: string): string[] {
  return input
    .split(/[,\n;]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeAgentTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/u, '')
    .replace(/\s+/gu, ' ')
    .toLowerCase();
}
