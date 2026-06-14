import { describe, expect, it } from "vitest";
import { buildAgentScoringContext } from "./agent-scoring-context.js";

describe("buildAgentScoringContext", () => {
  it("uses configured tags as scoring keywords without generic words from name and description", () => {
    const context = buildAgentScoringContext({
      name: "Free DevOps Engineering",
      description:
        "Agent for tracking open-source and freemium infrastructure tools",
      config: {
        tags: ["coolify", "prometheus", "systemd", "amnezia vpn"],
      },
    });

    expect(context.keywords).toEqual([
      "coolify",
      "prometheus",
      "systemd",
      "amnezia vpn",
    ]);
    expect(context.keywords).not.toContain("free");
    expect(context.keywords).not.toContain("open");
    expect(context.keywords).not.toContain("source");
    expect(context.keywords).not.toContain("agent");
    expect(context.keywords).not.toContain("tags");
  });

  it("uses string configured tags as scoring keywords", () => {
    const context = buildAgentScoringContext({
      name: "Information security",
      description: "Security news monitoring",
      config: {
        tags: "кибербезопасность vpn резервное копирование mitre att&ck",
      },
    });

    expect(context.keywords).toEqual([
      "кибербезопасность",
      "vpn",
      "резервное",
      "копирование",
      "mitre",
      "att&ck",
    ]);
    expect(context.keywords).not.toContain("information");
    expect(context.keywords).not.toContain("security");
  });
});
