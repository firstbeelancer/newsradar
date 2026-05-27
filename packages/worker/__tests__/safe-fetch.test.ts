import { describe, expect, it, vi } from "vitest";
import { safeFetchText, validateSafeUrl } from "../src/lib/safe-fetch.js";

function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain", ...init.headers },
    ...init,
  });
}

describe("safe-fetch", () => {
  it("blocks localhost and metadata endpoints before network fetch", async () => {
    const fetchImpl = vi.fn();

    await expect(safeFetchText("http://localhost/feed.xml", { fetchImpl })).rejects.toThrow(/Blocked host/);
    await expect(safeFetchText("http://169.254.169.254/latest/meta-data", { fetchImpl })).rejects.toThrow(/Blocked/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks private DNS resolutions", async () => {
    await expect(
      validateSafeUrl("https://example.com/rss", {
        resolveHost: async () => [{ address: "10.0.0.8", family: 4 }],
      })
    ).rejects.toThrow(/private IP/);
  });

  it("fetches allowed text with safe headers", async () => {
    const fetchImpl = vi.fn(async () => textResponse("hello"));

    const result = await safeFetchText("https://example.com/feed.xml", {
      fetchImpl,
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
    });

    expect(result.text).toBe("hello");
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.redirect).toBe("manual");
    expect(new Headers(init.headers).get("User-Agent")).toContain("NewsRadar");
  });

  it("rejects oversized responses using content-length or read cap", async () => {
    await expect(
      safeFetchText("https://example.com/big", {
        maxBytes: 4,
        fetchImpl: async () => textResponse("12345"),
        resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      })
    ).rejects.toThrow(/too large/);

    await expect(
      safeFetchText("https://example.com/big", {
        maxBytes: 4,
        fetchImpl: async () => textResponse("ok", { headers: { "content-length": "5" } }),
        resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      })
    ).rejects.toThrow(/too large/);
  });
});
