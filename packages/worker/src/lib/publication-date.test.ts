import { describe, expect, it } from "vitest";
import { extractPublicationDateFromHtml } from "./publication-date.js";

describe("extractPublicationDateFromHtml", () => {
  it("reads Timeweb itemprop metadata", () => {
    const html = '<meta content="2021-12-16" itemprop="datePublished">';
    expect(extractPublicationDateFromHtml(html)?.toISOString()).toBe("2021-12-16T00:00:00.000Z");
  });

  it("reads JSON-LD datePublished but ignores dateModified", () => {
    const html = '<script type="application/ld+json">{"dateModified":"2026-07-13","datePublished":"2026-07-09"}</script>';
    expect(extractPublicationDateFromHtml(html)?.toISOString()).toBe("2026-07-09T00:00:00.000Z");
  });

  it("does not invent a date", () => {
    expect(extractPublicationDateFromHtml("<html><body>Undated</body></html>")).toBeNull();
  });
});
