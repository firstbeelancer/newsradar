import { describe, expect, it } from "vitest";
import { parseRssXml } from "./rss-parser.js";

describe("parseRssXml", () => {
  it("reads RSS 1.0 dc:date publication dates", () => {
    const result = parseRssXml(`<?xml version="1.0"?><rdf:RDF><item><title>Study</title><link>https://example.com/study</link><dc:date>2026-07-12T12:30:00Z</dc:date></item></rdf:RDF>`);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].pubDate?.toISOString()).toBe("2026-07-12T12:30:00.000Z");
  });

  it("keeps a missing publication date as null", () => {
    const result = parseRssXml(`<?xml version="1.0"?><rss><channel><item><title>Undated</title><link>https://example.com/old</link></item></channel></rss>`);
    expect(result.items[0].pubDate).toBeNull();
  });
});
