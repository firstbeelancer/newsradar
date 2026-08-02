import { describe, expect, it } from "vitest";
import {
  ensureRussianBody,
  ensureRussianHeadline,
  isPollutedAiText,
  sanitizeTranslationOutput,
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
