/**
 * ------------------------------------------------------------------
 * Translator — AI-based translation to Russian
 * ------------------------------------------------------------------
 * Detects language and translates non-Russian text using the AI client.
 * ------------------------------------------------------------------
 */

import { complete } from "./ai-client.js";

/**
 * Quick heuristic language detection.
 * Returns ISO 639-1 language code (e.g., 'en', 'ru', 'de').
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) return "ru";

  const sample = text.slice(0, 500);

  // Cyrillic detection (Russian / Ukrainian / Belarusian)
  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) ?? []).length;
  const totalChars = sample.replace(/\s/g, "").length;

  if (totalChars > 0 && cyrillicChars / totalChars > 0.4) {
    return "ru";
  }

  // Latin-based heuristics
  const lower = sample.toLowerCase();

  // Common German markers
  if (/\b(der|die|das|ein|eine|und|ist|von|für|mit|auf|nicht|werden|wird|hat|zum|bei)\b/.test(lower)) {
    return "de";
  }

  // Common French markers
  if (/\b(le|la|les|un|une|et|est|pour|dans|sur|ce|cet|ces|qui|que|dont|où)\b/.test(lower)) {
    return "fr";
  }

  // Common Spanish markers
  if (/\b(el|la|los|las|un|una|y|es|para|en|por|con|del|al|lo|este)\b/.test(lower)) {
    return "es";
  }

  // Common English markers
  if (/\b(the|a|an|and|is|are|was|were|for|with|this|that|from|have|has|had|not|be|been)\b/.test(lower)) {
    return "en";
  }

  // If mostly Latin characters, assume English
  const latinChars = (sample.match(/[a-zA-Z]/g) ?? []).length;
  if (latinChars / totalChars > 0.5) {
    return "en";
  }

  return "unknown";
}

/**
 * Translate text to Russian using AI.
 *
 * @param text — text to translate
 * @param sourceLang — detected source language (or 'auto')
 * @returns Translated Russian text
 */
export async function translateToRussian(
  text: string,
  sourceLang: string = "auto"
): Promise<string> {
  if (!text || text.trim().length === 0) return "";

  const detectedLang = sourceLang === "auto" ? detectLanguage(text) : sourceLang;

  // Already Russian — no translation needed
  if (detectedLang === "ru") {
    return text;
  }

  const truncated = text.slice(0, 8_000); // Stay within token limits

  const systemPrompt = `You are a professional translator. Translate the following text from ${detectedLang.toUpperCase()} to Russian (RU). Preserve the original meaning, tone, and formatting. Respond with ONLY the translated text — no explanations, no prefixes.`;

  const result = await complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: truncated },
    ],
    temperature: 0.3,
    maxTokens: 4_000,
  });

  return result.trim();
}

/**
 * Translate article fields (title and description) to Russian.
 *
 * @param title — article title
 * @param description — article description (optional)
 * @returns Object with translated title, description, and detected language
 */
export async function translateArticle(
  title: string,
  description?: string
): Promise<{
  title: string;
  description: string;
  language: string;
}> {
  const detectedLang = detectLanguage(title);

  if (detectedLang === "ru") {
    return {
      title,
      description: description ?? "",
      language: "ru",
    };
  }

  const [translatedTitle, translatedDescription] = await Promise.all([
    translateToRussian(title, detectedLang),
    description ? translateToRussian(description, detectedLang) : Promise.resolve(""),
  ]);

  return {
    title: translatedTitle || title,
    description: translatedDescription || (description ?? ""),
    language: "ru",
  };
}
