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

export interface AgentFormValues {
  name: string;
  description: string;
  icon: string;
  color: string;
  subjectArea?: string;
  targetAudience: string;
  tone: string;
  systemPrompt: string;
  tags: string[];
  tagInput: string;
  scoringWeights: Record<string, number>;
}

/**
 * Build the agent create/update payload from the form state.
 *
 * `tags` is always sent as an array, including an empty one: `undefined` is
 * dropped by JSON.stringify, and the backend merges config objects, so omitting
 * the key made "clear all tags" a no-op and left scoring on the stale tag set.
 */
export function buildAgentFormPayload(values: AgentFormValues): CreateAgentDto {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    icon: values.icon,
    color: values.color,
    subjectArea: values.subjectArea,
    config: {
      targetAudience: values.targetAudience.trim() || undefined,
      tone: values.tone.trim() || undefined,
      systemPrompt: values.systemPrompt.trim() || undefined,
      tags: buildAgentTags(values.tags, values.tagInput),
      scoringWeights: values.scoringWeights,
    },
  } as CreateAgentDto;
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
