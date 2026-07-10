import { describe, expect, it } from "vitest";
import { deduplicateCollectionSources } from "./collection-sources.js";

describe("deduplicateCollectionSources", () => {
  it("queues a source linked to multiple agents only once", () => {
    expect(
      deduplicateCollectionSources([
        { id: "shared", name: "Shared feed" },
        { id: "agent-a", name: "Agent A feed" },
        { id: "shared", name: "Shared feed" },
        { id: "agent-b", name: "Agent B feed" },
      ])
    ).toEqual([
      { id: "shared", name: "Shared feed" },
      { id: "agent-a", name: "Agent A feed" },
      { id: "agent-b", name: "Agent B feed" },
    ]);
  });
});
