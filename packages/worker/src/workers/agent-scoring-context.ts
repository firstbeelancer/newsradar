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

export function buildAgentScoringContext(agent: AgentScoringContextInput): AgentScoringContext {
  const config = agent.config ?? {};
  const tags = Array.isArray(config.tags)
    ? config.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const topic = `${agent.name} ${agent.description ?? ""}${tags.length ? `\nTags: ${tags.join(", ")}` : ""}`.trim();
  const tone = (config.tone as string) ?? "professional";
  const keywords = tags.length > 0
    ? normalizeKeywords(tags)
    : normalizeKeywords(extractKeywords(`${agent.name} ${agent.description ?? ""}`));

  return { topic, tone, keywords };
}
