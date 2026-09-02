import { describe, expect, it } from "vitest";
import {
  ensureRussianBody,
  ensureRussianHeadline,
  isPollutedAiText,
  looksLikeRussian,
  resolveRussianBody,
  sanitizeTranslationOutput,
  splitForTranslation,
} from "./translator.js";

describe("translation output quality", () => {
  it("removes the exact Need to summarize leak seen in production", () => {
    const leaked =
      "Need to summarize in 2-3 informative Russian sentences. Focus on essence, cause, context. QCon 2026 — глобальная конференция разработчиков в Пекине.";

    expect(isPollutedAiText(leaked)).toBe(true);
    expect(sanitizeTranslationOutput(leaked)).toBe(
      "QCon 2026 — глобальная конференция разработчиков в Пекине."
    );
  });

  it("salvages Russian news text after a The user wants instruction echo", () => {
    const leaked =
      "The user wants a 2-3 sentence summary in Russian. DreamUp — сервис генерации изображений по текстовому описанию.";

    expect(isPollutedAiText(leaked)).toBe(true);
    expect(sanitizeTranslationOutput(leaked)).toBe(
      "DreamUp — сервис генерации изображений по текстовому описанию."
    );
  });

  it("rejects a pure request for missing source text", () => {
    const leaked = "Укажите полный текст новости, и я подготовлю краткое резюме.";

    expect(isPollutedAiText(leaked)).toBe(true);
    expect(sanitizeTranslationOutput(leaked)).toBe("");
  });

  it("never marks a non-Russian unchanged headline as ready without Cyrillic", () => {
    expect(ensureRussianHeadline("First EKS Cluster", "First EKS Cluster")).toBe(
      "Новость: First EKS Cluster"
    );
    expect(
      ensureRussianHeadline(
        "Первый кластер EKS",
        "First EKS Cluster"
      )
    ).toBe("Первый кластер EKS");
  });

  it("rejects an unchanged foreign article body", () => {
    expect(() =>
      ensureRussianBody(
        "QCon是由InfoQ主办的综合性技术盛会。",
        "QCon是由InfoQ主办的综合性技术盛会。"
      )
    ).toThrow("article body is not Russian");
    expect(
      ensureRussianBody(
        "QCon — международная конференция для разработчиков.",
        "QCon是由InfoQ主办的综合性技术盛会。"
      )
    ).toBe("QCon — международная конференция для разработчиков.");
  });
});


describe("translation resilience", () => {
  it("accepts a Russian body dominated by version numbers and latin product names", () => {
    // Digits and punctuation used to be counted as "non-Russian" characters,
    // so this valid translation failed the check and looped forever.
    const body =
      "Релиз Kubernetes 1.32.4 (2026-03-11, SHA256: a1b2c3): 42 исправления, 7 CVE, 12 улучшений API.";

    expect(looksLikeRussian(body)).toBe(true);
  });

  it("still rejects an untranslated foreign body", () => {
    expect(looksLikeRussian("QCon是由InfoQ主办的综合性技术盛会。")).toBe(false);
  });

  it("resolveRussianBody reports failure instead of throwing", () => {
    const failed = resolveRussianBody("Still English text here", "Still English text here");
    expect(failed).toEqual({ body: "", ok: false });

    const ok = resolveRussianBody(
      "QCon — международная конференция.",
      "QCon是由InfoQ主办的。"
    );
    expect(ok.ok).toBe(true);
    expect(ok.body).toContain("конференция");
  });

  it("splits long bodies for the GTX fallback instead of truncating them", () => {
    const sentence = "This is a reasonably long sentence about infrastructure. ";
    const text = sentence.repeat(120);

    const chunks = splitForTranslation(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1_400);
    }
    // Nothing is dropped: the old slice(0, 1500) lost everything past ~26 sentences.
    const rejoined = chunks.join(" ").replace(/\s+/g, " ").trim();
    expect(rejoined).toBe(text.replace(/\s+/g, " ").trim());
  });

  it("hard-splits a single oversized sentence rather than losing the tail", () => {
    const chunks = splitForTranslation("a".repeat(3_000));
    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toHaveLength(3_000);
  });
});
