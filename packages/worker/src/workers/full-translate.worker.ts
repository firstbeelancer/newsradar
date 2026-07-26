/**
 * On-demand full article translation for History → Переводы.
 * Separate from the feed pipeline title/summary translation.
 */
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Logger } from "pino";
import { db } from "../db/index.js";
import { articleFullTranslations, articles } from "../db/schema.js";
import { fetchArticleText } from "../lib/article-extractor.js";
import { detectLanguage, translateToRussian } from "../lib/translator.js";
import { cleanArticleText, stripEditorialTitlePrefix } from "../lib/text-cleaner.js";

export interface FullTranslateJob {
  translationId: string;
  articleId: string;
  workspaceId: string;
}

export async function processFullTranslate(
  job: Job<FullTranslateJob>,
  logger: Logger
): Promise<{ translationId: string; status: string }> {
  const { translationId, articleId, workspaceId } = job.data;

  const [row] = await db
    .select()
    .from(articleFullTranslations)
    .where(eq(articleFullTranslations.id, translationId))
    .limit(1);

  if (!row) {
    throw new Error(`Full translation not found: ${translationId}`);
  }

  await db
    .update(articleFullTranslations)
    .set({ status: "running", updatedAt: new Date(), error: null })
    .where(eq(articleFullTranslations.id, translationId));

  try {
    const [article] = await db
      .select({
        id: articles.id,
        title: articles.title,
        originalTitle: articles.originalTitle,
        description: articles.description,
        originalDescription: articles.originalDescription,
        content: articles.content,
        link: articles.link,
        detectedLang: articles.detectedLang,
        language: articles.language,
        workspaceId: articles.workspaceId,
      })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!article || article.workspaceId !== workspaceId) {
      throw new Error(`Article not found: ${articleId}`);
    }

    const sourceTitle = stripEditorialTitlePrefix(
      cleanArticleText(article.originalTitle || article.title || "")
    );
    let sourceBody = cleanArticleText(
      article.content ||
        article.originalDescription ||
        article.description ||
        ""
    );

    // Fetch full page text when RSS only gave a teaser.
    if (sourceBody.length < 400 && article.link) {
      try {
        const fetched = await fetchArticleText(article.link);
        if (fetched && fetched.length > sourceBody.length) {
          sourceBody = cleanArticleText(fetched);
        }
      } catch (err) {
        logger.warn(
          { articleId, err: err instanceof Error ? err.message : String(err) },
          "Full-translate page fetch failed, using stored body"
        );
      }
    }

    if (!sourceTitle && !sourceBody) {
      throw new Error("Нет текста для перевода");
    }

    const detectedLang =
      article.detectedLang ||
      detectLanguage(`${sourceTitle}\n${sourceBody}`) ||
      "unknown";

    let finalTitle = sourceTitle || article.title;
    let finalBody = sourceBody;

    if (detectedLang === "ru") {
      // Already Russian (e.g. Habr post marked [Перевод] by editors) — store full text as-is.
      finalTitle = stripEditorialTitlePrefix(finalTitle);
      if (!finalBody) {
        finalBody =
          cleanArticleText(article.description || "") ||
          `Полный текст недоступен. Оригинал: ${article.link}`;
      }
    } else {
      const [translatedTitle, translatedBody] = await Promise.all([
        sourceTitle
          ? translateToRussian(sourceTitle, detectedLang, workspaceId)
          : Promise.resolve(""),
        sourceBody
          ? translateToRussian(sourceBody, detectedLang, workspaceId)
          : Promise.resolve(""),
      ]);
      finalTitle =
        stripEditorialTitlePrefix(translatedTitle || sourceTitle) ||
        sourceTitle ||
        article.title;
      finalBody =
        translatedBody ||
        sourceBody ||
        cleanArticleText(article.description || "") ||
        `Полный текст недоступен. Оригинал: ${article.link}`;
    }

    await db
      .update(articleFullTranslations)
      .set({
        status: "completed",
        sourceLang: detectedLang,
        title: finalTitle,
        content: finalBody,
        originalTitle: sourceTitle || article.title,
        originalUrl: article.link,
        error: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articleFullTranslations.id, translationId));

    logger.info({ translationId, articleId, detectedLang }, "Full translation completed");
    return { translationId, status: "completed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(articleFullTranslations)
      .set({
        status: "failed",
        error: message.slice(0, 1000),
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(articleFullTranslations.id, translationId));
    logger.error({ translationId, articleId, err: message }, "Full translation failed");
    throw err instanceof Error ? err : new Error(message);
  }
}
