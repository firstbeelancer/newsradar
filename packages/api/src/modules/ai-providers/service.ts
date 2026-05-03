import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { aiProviders } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { encrypt, decrypt } from "../../lib/encryption.js";
import type { AiProvider, NewAiProvider } from "../../db/types.js";

// ─── CRUD ───

export async function createProvider(data: Omit<NewAiProvider, "apiKeyEncrypted"> & { apiKey?: string }) {
  let apiKeyEncrypted: string | null = null;

  if (data.apiKey) {
    apiKeyEncrypted = encrypt(data.apiKey);
  }

  const [provider] = await db
    .insert(aiProviders)
    .values({
      ...data,
      apiKeyEncrypted,
    })
    .returning();

  return provider;
}

export async function getProviderById(id: string, workspaceId: string) {
  const provider = await db.query.aiProviders.findFirst({
    where: and(eq(aiProviders.id, id), eq(aiProviders.workspaceId, workspaceId)),
  });
  if (!provider) {
    throw new AppError(404, "AI provider not found", "PROVIDER_NOT_FOUND");
  }
  return provider;
}

export async function listProviders(workspaceId: string) {
  const rows = await db.query.aiProviders.findMany({
    where: eq(aiProviders.workspaceId, workspaceId),
    orderBy: [aiProviders.createdAt],
  });

  // Don't return encrypted keys
  return rows.map((p) => ({
    ...p,
    apiKeyEncrypted: undefined,
    hasKey: !!p.apiKeyEncrypted,
  }));
}

export async function updateProvider(
  id: string,
  workspaceId: string,
  data: Partial<{
    name: string;
    model: string;
    baseUrl: string;
    apiKey: string;
    isActive: boolean;
  }>
) {
  const existing = await getProviderById(id, workspaceId);

  const updates: Partial<AiProvider> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.model !== undefined) updates.model = data.model;
  if (data.baseUrl !== undefined) updates.baseUrl = data.baseUrl;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  if (data.apiKey) {
    updates.apiKeyEncrypted = encrypt(data.apiKey);
  }

  const [updated] = await db
    .update(aiProviders)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(aiProviders.id, id), eq(aiProviders.workspaceId, workspaceId)))
    .returning();

  return updated;
}

export async function deleteProvider(id: string, workspaceId: string) {
  await getProviderById(id, workspaceId);
  await db.delete(aiProviders).where(and(eq(aiProviders.id, id), eq(aiProviders.workspaceId, workspaceId)));
  return { deleted: true };
}

// ─── Test connection ───

export async function testProviderConnection(id: string, workspaceId: string) {
  const provider = await getProviderById(id, workspaceId);

  if (!provider.apiKeyEncrypted) {
    return {
      success: false,
      message: "No API key configured for this provider",
    };
  }

  const apiKey = decrypt(provider.apiKeyEncrypted);
  const baseUrl = provider.baseUrl ?? getDefaultBaseUrl(provider.provider);

  try {
    const result = await pingProvider(provider.provider, baseUrl, apiKey, provider.model);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { success: false, message };
  }
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "google":
      return "https://generativelanguage.googleapis.com/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

async function pingProvider(
  provider: string,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; message: string; model?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    if (provider === "openai" || provider === "openrouter") {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `API error ${response.status}: ${error.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as { data?: Array<{ id: string }> };
      const modelAvailable = data.data?.some((m) => m.id.includes(model.split("/").pop() ?? model));

      return {
        success: true,
        message: modelAvailable ? `Connected. Model "${model}" is available.` : `Connected. Model "${model}" not found in available models.`,
        model,
      };
    }

    if (provider === "anthropic") {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `API error ${response.status}: ${error.slice(0, 200)}`,
        };
      }

      return {
        success: true,
        message: `Connected to Anthropic API successfully`,
        model,
      };
    }

    if (provider === "google") {
      // Google uses a different endpoint pattern
      const response = await fetch(
        `${baseUrl}/models?key=${apiKey}`,
        {
          method: "GET",
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `API error ${response.status}: ${error.slice(0, 200)}`,
        };
      }

      return {
        success: true,
        message: `Connected to Google Generative Language API successfully`,
        model,
      };
    }

    return { success: false, message: `Unsupported provider: ${provider}` };
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: `Connection error: ${message}` };
  }
}
