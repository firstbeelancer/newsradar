/**
 * ------------------------------------------------------------------
 * Translator - AI-based translation to Russian
 * ------------------------------------------------------------------
 * Detects language and translates non-Russian text using the AI client.
 * Falls back to Google GTX for short title/description text when the
 * configured AI provider is unavailable at runtime.
 * ------------------------------------------------------------------
 */

import { cleanArticleText, stripEditorialTitlePrefix } from "./text-cleaner.js";

/**
 * Quick heuristic language detection.
 * Returns ISO 639-1 language code (for example: en, ru, de).
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) return "ru";

  const sample = text.slice(0, 500);
  const totalChars = sample.replace(/\s/g, "").length;
  if (totalChars === 0) return "ru";

  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) ?? []).length;
  if (cyrillicChars / totalChars > 0.4) {
    return "ru";
  }

  // CJK: Chinese / Japanese / Korean — previously fell through as "unknown"
  // and often skipped meaningful translation heuristics.
  const hangulChars = (sample.match(/[\uAC00-\uD7AF]/g) ?? []).length;
  const hiraganaKatakana = (sample.match(/[\u3040-\u30FF]/g) ?? []).length;
  const hanChars = (sample.match(/[\u3400-\u9FFF\uF900-\uFAFF]/g) ?? []).length;
  const cjkChars = hangulChars + hiraganaKatakana + hanChars;
  if (cjkChars / totalChars > 0.15) {
    if (hangulChars / totalChars > 0.1) return "ko";
    if (hiraganaKatakana / totalChars > 0.05) return "ja";
    return "zh";
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
  if (latinChars / totalChars > 0.5) {
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
            "Ты профессиональный редактор новостной ленты. Сожми материал в 2–3 информативных предложения на русском. Не копируй первое предложение механически: выдели суть, причину и важный контекст. Верни ТОЛЬКО готовое русское резюме — без рассуждений, английских комментариев, XML/think-тегов и служебных инструкций.",
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

    const sanitized = sanitizeTranslationOutput(cleanArticleText(result)).slice(0, 700);
    if (sanitized && looksLikeRussian(sanitized) && !isPollutedAiText(sanitized)) {
      return sanitized;
    }
    // Reasoning models often echo the instruction in English — fall back to extractive RU/source text.
  } catch {
    // fall through
  }

  return buildExtractiveSummary(cleaned, title);
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

/** Instruction-echo / chain-of-thought markers from free reasoning models (EN + RU). */
const AI_LEAK_HEAD_RE =
  /the user wants(?: me to|[^.]{0,80}(?:summary|translation))|(?:i )?need to (?:translate|summarize|extract|compress|write|create)|let me (?:create|write|summarize|translate|extract|make|compress)|here(?:'s| is) (?:the )?(?:translation|summary)|based on the title information|however,? the actual article content is not provided|please (?:provide|send|share) (?:the )?(?:full )?(?:text|article|material)|i'll (?:summarize|translate|create|write)|as an ai|looking at the (?:title|headline|material)|the material is (?:quite )?short|compress (?:this|the) (?:news )?material|пользователь хочет|пользователь просит|мне нужно (?:сжать|суммировать|перевести|выделить|создать)|нужно (?:сжать|суммировать|перевести|выделить суть)|я должен (?:сжать|суммировать|перевести)|верн[уи] только (?:готовый )?summary|без рассуждений|укажите полный текст|пожалуйста,? предоставьте (?:полный )?текст|на основании заголовка/i;

export function looksLikeRussian(text: string): boolean {
  const sample = text.slice(0, 400);
  const total = sample.replace(/\s/g, "").length;
  if (total === 0) return false;
  const cyr = (sample.match(/[\u0400-\u04FF]/g) ?? []).length;
  return cyr / total > 0.25;
}

export function isPollutedAiText(text: string | null | undefined): boolean {
  if (!text) return false;
  const sample = text.slice(0, 700);
  if (/<\/?think\b/i.test(sample)) return true;
  return AI_LEAK_HEAD_RE.test(sample);
}

/**
 * A non-Russian source must never be persisted as a ready headline without
 * any Cyrillic. Some translation providers intentionally keep short product
 * names unchanged, so retain that name but make the UI state unambiguously RU.
 */
export function ensureRussianHeadline(translatedTitle: string, sourceTitle: string): string {
  const translated = stripEditorialTitlePrefix(cleanArticleText(translatedTitle));
  if (translated && looksLikeRussian(translated) && !isPollutedAiText(translated)) {
    return translated;
  }

  const source = stripEditorialTitlePrefix(cleanArticleText(sourceTitle));
  if (source && looksLikeRussian(source) && !isPollutedAiText(source)) {
    return source;
  }

  const retainedName = translated && !isPollutedAiText(translated) ? translated : source;
  return retainedName ? `Новость: ${retainedName}` : "Новость без заголовка";
}

/** Reject a provider fallback that returned the foreign body unchanged. */
export function ensureRussianBody(translatedBody: string, sourceBody: string): string {
  const translated = cleanArticleText(translatedBody);
  if (translated && looksLikeRussian(translated) && !isPollutedAiText(translated)) {
    return translated;
  }

  const source = cleanArticleText(sourceBody);
  if (source && detectLanguage(source) === "ru" && !isPollutedAiText(source)) {
    return source;
  }

  throw new Error("Translation failed: article body is not Russian after provider fallback");
}

/**
 * Models sometimes leak chain-of-thought / instruction echo into the completion
 * (e.g. "<think>The user wants me to translate..." or English planning followed by
 * a real Russian summary). Strip tags, salvage Cyrillic tail when possible.
 */
export function sanitizeTranslationOutput(text: string): string {
  let cleaned = text ?? "";
  cleaned = cleaned.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, " ");
  cleaned = cleaned.replace(/<\/?think\b[^>]*>/gi, " ");
  cleaned = cleaned.replace(/^\s*(assistant|system|user)\s*:\s*/i, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (!cleaned) return "";

  const head = cleaned.slice(0, 700);
  const hasLeak = cleaned.startsWith("<think") || AI_LEAK_HEAD_RE.test(head);

  if (hasLeak) {
    // Free models often dump English/Russian meta-reasoning, then append the real summary.
    // Prefer content after a clear separator sentence that looks like news (not instruction).
    const afterMeta = cleaned.split(
      /(?<=[.!?…])\s+(?=[А-ЯЁA-Z])/
    );
    let candidate = cleaned;
    if (afterMeta.length > 1) {
      // take the longest tail segment that does not itself start with a leak marker
      for (let i = afterMeta.length - 1; i >= 0; i -= 1) {
        const part = afterMeta.slice(i).join(" ").trim();
        if (part && !AI_LEAK_HEAD_RE.test(part.slice(0, 120)) && looksLikeRussian(part)) {
          candidate = part;
          break;
        }
      }
    } else {
      // Keep from the first capital Cyrillic letter (start of a Russian sentence).
      const cyrStart = cleaned.search(/[А-ЯЁ]/);
      if (cyrStart >= 0) {
        candidate = cleaned.slice(cyrStart).trim();
      }
    }

    // Still pure meta (e.g. entire text is «Пользователь хочет…» without news body).
    if (!candidate || AI_LEAK_HEAD_RE.test(candidate.slice(0, 160))) {
      return "";
    }
    cleaned = candidate;
    if (isPollutedAiText(cleaned) && !looksLikeRussian(cleaned)) {
      return "";
    }
  }

  // Pure English instruction echo with no salvageable Russian.
  if (!looksLikeRussian(cleaned) && AI_LEAK_HEAD_RE.test(cleaned.slice(0, 400))) {
    return "";
  }

  return cleaned;
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
  const systemPrompt = `You are a professional translator. Translate the following text from ${detectedLang.toUpperCase()} to Russian (RU). Preserve the original meaning, tone, and formatting. Respond with ONLY the translated Russian text. Do not include reasoning, notes, XML tags, or English commentary.`;

  try {
    const { complete } = await import("./ai-client.js");
    const result = await complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncated },
      ],
      workspaceId,
      process: "translation",
      temperature: 0.2,
      maxTokens: 4_000,
    });

    const cleaned = sanitizeTranslationOutput(result);
    if (cleaned && looksLikeRussian(cleaned)) {
      return cleaned;
    }

    // AI returned garbage / English reasoning — fall through to GTX.
  } catch {
    // fall through to GTX
  }

  const fallback = await translateViaGoogleGtx(truncated, detectedLang);
  const cleanedFallback = sanitizeTranslationOutput(fallback);
  if (!cleanedFallback) {
    throw new Error("Translation failed: empty result after sanitize");
  }
  return cleanedFallback;
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
  const normalizedTitle = stripEditorialTitlePrefix(cleanArticleText(title));
  const normalizedDescription = cleanArticleText(description ?? "");
  const normalizedContent = cleanArticleText(content ?? "");
  const sourceBody =
    normalizedContent.length > normalizedDescription.length + 80
      ? normalizedContent
      : normalizedDescription || normalizedContent;
  const titleLang = detectLanguage(normalizedTitle);
  const bodyLang = sourceBody ? detectLanguage(sourceBody) : "ru";

  if (titleLang === "ru" && bodyLang === "ru") {
    const aiSummary = await summarizeToRussian(sourceBody, normalizedTitle, workspaceId);
    const fallbackPreview = buildTitleOnlyPreview(normalizedTitle);
    const safeSummary =
      (aiSummary && !isPollutedAiText(aiSummary) ? aiSummary : "") ||
      (normalizedDescription && !isPollutedAiText(normalizedDescription)
        ? normalizedDescription
        : "") ||
      fallbackPreview;
    return {
      title: normalizedTitle,
      description: safeSummary,
      content: normalizedContent,
      aiSummary: safeSummary,
      language: "ru",
    };
  }

  const [translatedTitle, translatedBody] = await Promise.all([
    titleLang === "ru"
      ? Promise.resolve(normalizedTitle)
      : translateToRussian(normalizedTitle, titleLang, workspaceId),
    sourceBody
      ? bodyLang === "ru"
        ? Promise.resolve(sourceBody)
        : translateToRussian(sourceBody, bodyLang, workspaceId)
      : Promise.resolve(""),
  ]);
  const safeTranslatedTitle = ensureRussianHeadline(translatedTitle, normalizedTitle);
  const safeTranslatedBody = sourceBody
    ? bodyLang === "ru"
      ? sourceBody
      : ensureRussianBody(translatedBody, sourceBody)
    : "";
  const translatedSummary = await summarizeToRussian(
    safeTranslatedBody,
    safeTranslatedTitle,
    workspaceId
  );
  const fallbackPreview = buildTitleOnlyPreview(safeTranslatedTitle);
  const extractive = buildExtractiveSummary(
    safeTranslatedBody,
    safeTranslatedTitle
  );
  const safeSummary =
    (translatedSummary && !isPollutedAiText(translatedSummary) ? translatedSummary : "") ||
    (extractive && !isPollutedAiText(extractive) ? extractive : "") ||
    (safeTranslatedBody && !isPollutedAiText(safeTranslatedBody)
      ? safeTranslatedBody.slice(0, 700)
      : "") ||
    fallbackPreview;

  return {
    title: safeTranslatedTitle,
    description: safeSummary,
    content: safeTranslatedBody || normalizedContent,
    aiSummary: safeSummary,
    language: "ru",
  };
}
