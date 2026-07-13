import { describe, expect, it } from "vitest";
import { probeRssBody, probeTelegramBody, telegramPreviewUrl } from "./source-probe.js";

describe("source probes", () => {
  it("rejects XML feeds without articles", () => {
    expect(probeRssBody("<?xml version=\"1.0\"?><rss><channel /></rss>")).toEqual({
      validXml: true,
      articleCount: 0,
      datedArticleCount: 0,
    });
  });

  it("counts RSS and Atom entries and publication dates", () => {
    const probe = probeRssBody("<feed><entry><updated>2026-07-13</updated></entry><entry /></feed>");
    expect(probe).toEqual({ validXml: true, articleCount: 2, datedArticleCount: 1 });
  });

  it("checks actual Telegram preview messages", () => {
    expect(probeTelegramBody('<div class="tgme_widget_message_wrap"></div>')).toBe(1);
    expect(telegramPreviewUrl(null, "https://t.me/example_channel")).toBe("https://t.me/s/example_channel");
  });
});
