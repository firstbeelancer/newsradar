import { describe, expect, it } from "vitest";
import { buildAgentScoringContext } from "./agent-scoring-context.js";

/**
 * These assertions pin the contract the owner asked us to verify: an agent's
 * configured tags — not a guess derived from its name — drive the scoring
 * keywords and the topic the AI is asked to grade relevance against.
 */
describe("buildAgentScoringContext", () => {
  it("uses the configured tags as scoring keywords", () => {
    const ctx = buildAgentScoringContext({
      name: "DevOps",
      description: "Инфраструктура и эксплуатация",
      config: { tags: ["Kubernetes", "Terraform", "SRE"] },
    });

    expect(ctx.keywords).toEqual(["kubernetes", "terraform", "sre"]);
  });

  it("puts the tags into the topic passed to the AI prompt", () => {
    const ctx = buildAgentScoringContext({
      name: "DevOps",
      description: "Инфраструктура",
      config: { tags: ["kubernetes", "sre"] },
    });

    expect(ctx.topic).toContain("DevOps");
    expect(ctx.topic).toContain("Tags: kubernetes, sre");
  });

  it("accepts tags stored as a delimited string", () => {
    const ctx = buildAgentScoringContext({
      name: "AI",
      description: null,
      config: { tags: "gemini, openrouter; llm" },
    });

    expect(ctx.keywords).toEqual(["gemini", "openrouter", "llm"]);
  });

  it("falls back to name/description keywords only when there are no tags", () => {
    const ctx = buildAgentScoringContext({
      name: "Кибербезопасность",
      description: "уязвимости и эксплойты",
      config: { tags: [] },
    });

    expect(ctx.keywords).toContain("кибербезопасность");
    expect(ctx.keywords).toContain("уязвимости");
  });

  it("reads the agent tone from config", () => {
    expect(
      buildAgentScoringContext({
        name: "AI",
        description: null,
        config: { tone: "ироничный" },
      }).tone
    ).toBe("ироничный");

    expect(
      buildAgentScoringContext({ name: "AI", description: null, config: null }).tone
    ).toBe("professional");
  });
});
