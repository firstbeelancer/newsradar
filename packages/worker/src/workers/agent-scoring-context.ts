import { extractKeywords, normalizeKeywords } from "../lib/keywords.js";

export interface AgentScoringContextInput {
  name: string;
  description: string | null;
  config: Record<string, unknown> | null;
}

export interface AgentScoringContext {
  topic?: string;
  tone?: string;
  keywords: string[];
}

function getConfiguredTags(config: Record<string, unknown>): string[] {
  if (Array.isArray(config.tags)) {
    return config.tags.filter((tag): tag is string => typeof tag === "string");
  }

  if (typeof config.tags === "string") {
    return config.tags
      .split(/[\s,;]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length >= 2);
  }

  return [];
}

export function buildAgentScoringContext(agent: AgentScoringContextInput): AgentScoringContext {
  const config = agent.config ?? {};
  const tags = getConfiguredTags(config);
  const topic = `${agent.name} ${agent.description ?? ""}${tags.length ? `\nTags: ${tags.join(", ")}` : ""}`.trim();
  const tone = (config.tone as string) ?? "professional";
  const keywords = tags.length > 0
    ? normalizeKeywords(tags)
    : normalizeKeywords(extractKeywords(`${agent.name} ${agent.description ?? ""}`));

  return { topic, tone, keywords };
}
