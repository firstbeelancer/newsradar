/**
 * ------------------------------------------------------------------
 * Worker: generate-post
 * ------------------------------------------------------------------
 * Loads template and articles, forms prompt with variable replacement,
 * calls AI with streaming, publishes progress via Redis pub/sub,
 * saves result in generated_posts.
 * ------------------------------------------------------------------
 */

import { db } from "../db/index.js";
import {
  articles,
  contentTemplates,
  generatedPosts,
} from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { streamComplete, complete } from "../lib/ai-client.js";
import { redis } from "../connection/redis.js";
import type { Job } from "bullmq";
import type { Logger } from "pino";

export interface GeneratePostJob {
  templateId: string;
  articleIds: string[];
  operationId: string;
  workspaceId: string;
  agentId?: string;
  customPrompt?: string;
}

/**
 * Publish generation progress to Redis pub/sub for SSE.
 */
async function publishProgress(
  operationId: string,
  data: {
    status: "pending" | "generating" | "completed" | "error";
    content?: string;
    chunk?: string;
    error?: string;
  }
): Promise<void> {
  const channel = `newsradar:generation:${operationId}`;
  await redis.publish(channel, JSON.stringify({ ...data, timestamp: Date.now() }));
}

/**
 * Build prompt from template, replacing {{variables}}.
 */
function buildPrompt(
  template: { systemPrompt: string; userPrompt: string },
  articleTexts: string[],
  variables: Record<string, string> = {}
): { systemPrompt: string; userPrompt: string } {
  const content = articleTexts.join("\n\n---\n\n");

  let userPrompt = template.userPrompt;

  // Replace {{content}} variable
  userPrompt = userPrompt.replace(/\{\{content\}\}/g, content);

  // Replace custom variables
  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
  };
}

/**
 * Process a generate-post job.
 */
export async function processGeneratePost(
  job: Job<GeneratePostJob>,
  logger: Logger
): Promise<{ postId: string; content: string }> {
  const { templateId, articleIds, operationId, workspaceId, agentId, customPrompt } = job.data;

  logger.info({ operationId, templateId, articleCount: articleIds.length }, "Generating post");

  await publishProgress(operationId, { status: "pending" });

  // Load template (optional — can use customPrompt without a template)
  let template: typeof contentTemplates.$inferSelect | undefined;
  if (templateId) {
    const templateResult = await db
      .select()
      .from(contentTemplates)
      .where(and(eq(contentTemplates.id, templateId), eq(contentTemplates.workspaceId, workspaceId)))
      .limit(1);
    template = templateResult[0];
  }
  // If no template found and no customPrompt, look for a default
  if (!template && !customPrompt) {
    const defaultResult = await db
      .select()
      .from(contentTemplates)
      .where(and(eq(contentTemplates.workspaceId, workspaceId), eq(contentTemplates.isDefault, true)))
      .limit(1);
    template = defaultResult[0];
  }

  // Load articles
  const selectedArticles = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.workspaceId, workspaceId),
        sql`${articles.id} = ANY(${articleIds})`
      )
    )
    .orderBy(sql`${articles.score} DESC`);

  // Build article texts
  const articleTexts = selectedArticles.map((a) => {
    let text = `Title: ${a.title}`;
    if (a.description) text += `\nDescription: ${a.description}`;
    if (a.aiSummary) text += `\nSummary: ${a.aiSummary}`;
    return text;
  });

  let systemPrompt: string;
  let userPrompt: string;

  if (customPrompt) {
    // Use custom prompt (e.g., for deepsearch)
    systemPrompt = "You are a professional news analyst. Create detailed, well-structured content in Russian based on the provided articles.";
    const content = articleTexts.join("\n\n---\n\n");
    userPrompt = customPrompt.replace(/\{\{content\}\}/g, content);
    if (!userPrompt.includes(content)) {
      userPrompt += `\n\nSource articles:\n${content}`;
    }
  } else if (template) {
    const built = buildPrompt(template, articleTexts);
    systemPrompt = built.systemPrompt;
    userPrompt = built.userPrompt;
  } else {
    // No template, no custom prompt — use defaults
    systemPrompt = "You are a professional news editor. Create engaging content based on the provided articles.";
    userPrompt = `Based on the following articles, create a post:\n\n${articleTexts.join("\n\n---\n\n")}`;
  }

  await publishProgress(operationId, { status: "generating" });

  // Generate content with streaming
  let fullContent = "";

  try {
    fullContent = await streamComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 4_000,
      onChunk: async (chunk) => {
        fullContent += chunk;
        await publishProgress(operationId, {
          status: "generating",
          chunk,
          content: fullContent,
        });
      },
    });
  } catch (err) {
    // Fallback to non-streaming on stream error
    logger.warn({ operationId, err: (err as Error).message }, "Streaming failed, using fallback");
    fullContent = await complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 4_000,
    });
  }

  // Save generated post
  const [post] = await db
    .insert(generatedPosts)
    .values({
      workspaceId,
      agentId: agentId ?? null,
      templateId: template.id,
      type: "manual",
      title: selectedArticles[0]?.title ?? "Generated post",
      content: fullContent,
      articleCount: selectedArticles.length,
      articlesSnapshot: selectedArticles.map((a) => ({
        id: a.id,
        title: a.title,
        link: a.link,
        score: a.score,
      })),
      promptSnapshot: userPrompt,
      modelSnapshot: "platform-ai",
    })
    .returning();

  await publishProgress(operationId, {
    status: "completed",
    content: fullContent,
  });

  logger.info(
    { operationId, postId: post.id, contentLength: fullContent.length },
    "Post generated successfully"
  );

  return { postId: post.id, content: fullContent };
}
