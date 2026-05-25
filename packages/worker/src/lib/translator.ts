/**
 * ------------------------------------------------------------------
 * Translator - AI-based translation to Russian
 * ------------------------------------------------------------------
 * Detects language and translates non-Russian text using the AI client.
 * Falls back to Google GTX for short title/description text when the
 * configured AI provider is unavailable at runtime.
 * ------------------------------------------------------------------
 */

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

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function buildExtractiveSummary(text: string, title = "", maxChars = 520): string {
  const cleaned = cleanArticleText(text);
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;

  const titleWords = new Set(
    title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 3)
  );

  const sentences = splitSentences(cleaned).slice(0, 14);
  const scored = sentences
    .map((sentence, index) => {
      const words = sentence.toLowerCase().split(/[^\p{L}\p{N}]+/u);
      const titleHits = words.filter((word) => titleWords.has(word)).length;
      const lengthScore = sentence.length >= 70 && sentence.length <= 240 ? 2 : 0;
      return { sentence, index, score: titleHits * 3 + lengthScore + Math.max(0, 4 - index) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index);

  const summary = scored.map((item) => item.sentence).join(" ").trim();
  return summary.length > maxChars ? `${summary.slice(0, maxChars - 1).trim()}…` : summary;
}

export function buildTitleOnlyPreview(title: string): string {
  const cleanedTitle = cleanArticleText(title);
  if (!cleanedTitle) return "";
  return `Короткая новость по теме: ${cleanedTitle}.`;
}

async function summarizeToRussian(
  text: string,
  title: string,
  workspaceId?: string
): Promise<string> {
  const cleaned = cleanArticleText(text);
  if (!cleaned) return "";

  try {
    const { complete } = await import("./ai-client.js");
    const result = await complete({
      messages: [
        {
          role: "system",
          content:
            "Ты профессиональный редактор новостной ленты. Сожми материал в 2-3 информативных предложения на русском. Не копируй первое предложение механически, выдели суть, причину и важный контекст. Верни только summary.",
        },
        {
          role: "user",
          content: `Заголовок: ${title}\n\nМатериал:\n${cleaned.slice(0, 6_000)}`,
        },
      ],
      workspaceId,
      process: "ingest_analysis",
      temperature: 0.2,
      maxTokens: 500,
    });

    return cleanArticleText(result).slice(0, 700);
  } catch {
    return buildExtractiveSummary(cleaned, title);
  }
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
    const { complete } = await import("./ai-client.js");
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
  aiSummary: string;
  language: string;
}> {
  const normalizedTitle = cleanArticleText(title);
  const normalizedDescription = cleanArticleText(description ?? "");
  const normalizedContent = cleanArticleText(content ?? "");
  const detectedLang = detectLanguage(`${normalizedTitle}\n${normalizedDescription || normalizedContent}`);
  const sourceBody =
    normalizedContent.length > normalizedDescription.length + 80
      ? normalizedContent
      : normalizedDescription || normalizedContent;

  if (detectedLang === "ru") {
    const aiSummary = await summarizeToRussian(sourceBody, normalizedTitle, workspaceId);
    const fallbackPreview = buildTitleOnlyPreview(normalizedTitle);
    return {
      title: normalizedTitle,
      description: aiSummary || normalizedDescription || normalizedContent || fallbackPreview,
      content: normalizedContent,
      aiSummary: aiSummary || normalizedDescription || normalizedContent || fallbackPreview,
      language: "ru",
    };
  }

  const [translatedTitle, translatedBody] = await Promise.all([
    translateToRussian(normalizedTitle, detectedLang, workspaceId),
    sourceBody
      ? translateToRussian(sourceBody, detectedLang, workspaceId)
      : Promise.resolve(""),
  ]);
  const translatedSummary = await summarizeToRussian(translatedBody || sourceBody, translatedTitle || normalizedTitle, workspaceId);
  const fallbackPreview = buildTitleOnlyPreview(translatedTitle || normalizedTitle);

  return {
    title: translatedTitle || normalizedTitle,
    description: translatedSummary || translatedBody || sourceBody || fallbackPreview,
    content: translatedBody || normalizedContent,
    aiSummary: translatedSummary || buildExtractiveSummary(translatedBody || sourceBody, translatedTitle || normalizedTitle) || fallbackPreview,
    language: "ru",
  };
}
