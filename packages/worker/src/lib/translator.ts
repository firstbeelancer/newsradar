/**
 * ------------------------------------------------------------------
 * Translator - AI-based translation to Russian
 * ------------------------------------------------------------------
 * Detects language and translates non-Russian text using the AI client.
 * Falls back to Google GTX for short title/description text when the
 * configured AI provider is unavailable at runtime.
 * ------------------------------------------------------------------
 */

import { complete } from "./ai-client.js";
import { cleanArticleText } from "./text-cleaner.js";

/**
 * Quick heuristic language detection.
 * Returns ISO 639-1 language code (for example: en, ru, de).
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) return "ru";

  const sample = text.slice(0, 500);

  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) ?? []).length;
  const totalChars = sample.replace(/\s/g, "").length;

  if (totalChars > 0 && cyrillicChars / totalChars > 0.4) {
    return "ru";
  }

  const lower = sample.toLowerCase();

  if (/\b(der|die|das|ein|eine|und|ist|von|für|mit|auf|nicht|werden|wird|hat|zum|bei)\b/.test(lower)) {
    return "de";
  }

  if (/\b(le|la|les|un|une|et|est|pour|dans|sur|ce|cet|ces|qui|que|dont|où)\b/.test(lower)) {
    return "fr";
  }

  if (/\b(el|la|los|las|un|una|y|es|para|en|por|con|del|al|lo|este)\b/.test(lower)) {
    return "es";
  }

  if (/\b(the|a|an|and|is|are|was|were|for|with|this|that|from|have|has|had|not|be|been)\b/.test(lower)) {
    return "en";
  }

  const latinChars = (sample.match(/[a-zA-Z]/g) ?? []).length;
  if (totalChars > 0 && latinChars / totalChars > 0.5) {
    return "en";
  }

  return "unknown";
}

async function translateViaGoogleGtx(
  text: string,
  sourceLang: string
): Promise<string> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLang === "unknown" ? "auto" : sourceLang);
  url.searchParams.set("tl", "ru");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text.slice(0, 1_500));

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 NewsRadar/translation-fallback",
      Accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Google GTX fallback error ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Google GTX fallback returned unexpected payload");
  }

  const translated = (data[0] as Array<unknown>)
    .map((part) => (Array.isArray(part) ? String(part[0] ?? "") : ""))
    .join("")
    .trim();

  if (!translated) {
    throw new Error("Google GTX fallback returned empty translation");
  }

  return translated;
}

/**
 * Translate text to Russian.
 */
export async function translateToRussian(
  text: string,
  sourceLang: string = "auto",
  workspaceId?: string
): Promise<string> {
  if (!text || text.trim().length === 0) return "";

  const detectedLang = sourceLang === "auto" ? detectLanguage(text) : sourceLang;
  if (detectedLang === "ru") {
    return text;
  }

  const truncated = text.slice(0, 8_000);
  const systemPrompt = `You are a professional translator. Translate the following text from ${detectedLang.toUpperCase()} to Russian (RU). Preserve the original meaning, tone, and formatting. Respond with ONLY the translated text.`;

  try {
    const result = await complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncated },
      ],
      workspaceId,
      process: "translation",
      temperature: 0.3,
      maxTokens: 4_000,
    });

    return result.trim();
  } catch (aiError) {
    const fallback = await translateViaGoogleGtx(truncated, detectedLang);
    if (fallback) {
      return fallback;
    }
    throw aiError;
  }
}

/**
 * Translate article fields (title and description) to Russian.
 */
export async function translateArticle(
  title: string,
  description?: string,
  content?: string,
  workspaceId?: string
): Promise<{
  title: string;
  description: string;
  content: string;
  language: string;
}> {
  const detectedLang = detectLanguage(title);
  const normalizedDescription = cleanArticleText(description ?? "");
  const normalizedContent = cleanArticleText(content ?? "");
  const sourceBody = normalizedDescription || normalizedContent;

  if (detectedLang === "ru") {
    return {
      title,
      description: normalizedDescription || normalizedContent,
      content: normalizedContent,
      language: "ru",
    };
  }

  const [translatedTitle, translatedBody] = await Promise.all([
    translateToRussian(title, detectedLang, workspaceId),
    sourceBody
      ? translateToRussian(sourceBody, detectedLang, workspaceId)
      : Promise.resolve(""),
  ]);

  return {
    title: translatedTitle || title,
    description: translatedBody || sourceBody,
    content: translatedBody || normalizedContent,
    language: "ru",
  };
}
