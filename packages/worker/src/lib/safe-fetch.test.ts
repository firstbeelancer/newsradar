import { describe, expect, it } from "vitest";
import { decodeTextBytes } from "./safe-fetch.js";

describe("decodeTextBytes", () => {
  it("honors a KOI8-R XML declaration", () => {
    const prefix = Array.from('<?xml version="1.0" encoding="koi8-r"?><title>', (char) => char.charCodeAt(0));
    const title = [0xf0, 0xd2, 0xc9, 0xd7, 0xc5, 0xd4];
    const suffix = Array.from("</title>", (char) => char.charCodeAt(0));
    expect(decodeTextBytes(Uint8Array.from([...prefix, ...title, ...suffix]))).toContain("Привет");
  });

  it("honors a Windows-1251 HTTP charset", () => {
    const bytes = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
    expect(decodeTextBytes(bytes, "text/xml; charset=windows-1251")).toBe("Привет");
  });
});
