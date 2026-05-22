import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { aiProviders } from "../../db/schema.js";
import type { AiProvider, NewAiProvider } from "../../db/types.js";
import { encrypt, decrypt } from "../../lib/encryption.js";
import { AppError } from "../../middleware/error-handler.js";

export const AI_PROVIDER_PROCESS_VALUES = [
  "search",
  "translation",
  "ingest_analysis",
  "scoring",
  "generation",
  "deepsearch",
] as const;

export type AiProviderProcess = (typeof AI_PROVIDER_PROCESS_VALUES)[number];

const LEGACY_DEFAULT_PROCESS_ASSIGNMENTS: AiProviderProcess[] = [...AI_PROVIDER_PROCESS_VALUES];

function normalizeAssignedTo(processes?: string[] | null): AiProviderProcess[] {
  if (!Array.isArray(processes)) {
    return [];
  }

  return Array.from(
    new Set(
      processes.filter((value): value is AiProviderProcess =>
        AI_PROVIDER_PROCESS_VALUES.includes(value as AiProviderProcess)
      )
    )
  );
}

async function clearProcessAssignments(
  workspaceId: string,
  providerIdToKeep: string,
  processes: AiProviderProcess[]
) {
  if (processes.length === 0) {
    return;
  }

  const workspaceProviders = await db.query.aiProviders.findMany({
    where: eq(aiProviders.workspaceId, workspaceId),
  });

  for (const provider of workspaceProviders) {
    if (provider.id === providerIdToKeep) {
      continue;
    }

    const currentAssignments = normalizeAssignedTo(provider.assignedTo as string[] | undefined);
    const nextAssignments = currentAssignments.filter((value) => !processes.includes(value));

    if (nextAssignments.length !== currentAssignments.length) {
      await db
        .update(aiProviders)
        .set({
          assignedTo: nextAssignments,
          updatedAt: new Date(),
        })
        .where(and(eq(aiProviders.id, provider.id), eq(aiProviders.workspaceId, workspaceId)));
    }
  }
}

async function backfillLegacyAssignments(workspaceId: string) {
  const activeProviders = await db.query.aiProviders.findMany({
    where: and(eq(aiProviders.workspaceId, workspaceId), eq(aiProviders.isActive, true)),
  });

  if (activeProviders.length !== 1) {
    return;
  }

  const legacyProvider = activeProviders[0];
  const assignedTo = normalizeAssignedTo(legacyProvider.assignedTo as string[] | undefined);
  if (assignedTo.length > 0) {
    return;
  }

  await db
    .update(aiProviders)
    .set({
      assignedTo: LEGACY_DEFAULT_PROCESS_ASSIGNMENTS,
      updatedAt: new Date(),
    })
    .where(and(eq(aiProviders.id, legacyProvider.id), eq(aiProviders.workspaceId, workspaceId)));
}

export async function resolveProviderForProcess(
  workspaceId: string,
  process: AiProviderProcess,
  requestedProvider?: string,
  requestedModel?: string
) {
  await backfillLegacyAssignments(workspaceId);

  const providers = await db.query.aiProviders.findMany({
    where: and(eq(aiProviders.workspaceId, workspaceId), eq(aiProviders.isActive, true)),
  });

  const assignedProviders = providers.filter((provider) =>
    normalizeAssignedTo(provider.assignedTo as string[] | undefined).includes(process)
  );
  const pool = assignedProviders.length > 0 ? assignedProviders : providers;

  if (requestedProvider || requestedModel) {
    const explicitMatch = pool.find((provider) => {
      const providerMatches = requestedProvider ? provider.provider === requestedProvider : true;
      const modelMatches = requestedModel ? provider.model === requestedModel : true;
      return providerMatches && modelMatches;
    });

    if (explicitMatch) {
      return explicitMatch;
    }
  }

  return pool[0];
}

export async function createProvider(data: Omit<NewAiProvider, "apiKeyEncrypted"> & { apiKey?: string }) {
  let apiKeyEncrypted: string | null = null;
  const assignedTo = normalizeAssignedTo(data.assignedTo as string[] | undefined);

  if (data.apiKey) {
    apiKeyEncrypted = encrypt(data.apiKey);
  }

  const [provider] = await db
    .insert(aiProviders)
    .values({
      ...data,
      assignedTo,
      apiKeyEncrypted,
    })
    .returning();

  await clearProcessAssignments(data.workspaceId, provider.id, assignedTo);

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
  await backfillLegacyAssignments(workspaceId);

  const rows = await db.query.aiProviders.findMany({
    where: eq(aiProviders.workspaceId, workspaceId),
    orderBy: [aiProviders.createdAt],
  });

  return rows.map((provider) => ({
    ...provider,
    assignedTo: normalizeAssignedTo(provider.assignedTo as string[] | undefined),
    apiKeyEncrypted: undefined,
    hasKey: !!provider.apiKeyEncrypted,
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
    assignedTo: string[];
  }>
) {
  const existing = await getProviderById(id, workspaceId);

  const updates: Partial<AiProvider> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.model !== undefined) updates.model = data.model;
  if (data.baseUrl !== undefined) updates.baseUrl = data.baseUrl;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const nextAssignedTo =
    data.assignedTo !== undefined
      ? normalizeAssignedTo(data.assignedTo)
      : normalizeAssignedTo(existing.assignedTo as string[] | undefined);

  if (data.assignedTo !== undefined) {
    updates.assignedTo = nextAssignedTo;
  }

  if (data.apiKey) {
    updates.apiKeyEncrypted = encrypt(data.apiKey);
  }

  const [updated] = await db
    .update(aiProviders)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(aiProviders.id, id), eq(aiProviders.workspaceId, workspaceId)))
    .returning();

  if (data.assignedTo !== undefined) {
    await clearProcessAssignments(workspaceId, id, nextAssignedTo);
  }

  return updated;
}

export async function deleteProvider(id: string, workspaceId: string) {
  await getProviderById(id, workspaceId);
  await db.delete(aiProviders).where(and(eq(aiProviders.id, id), eq(aiProviders.workspaceId, workspaceId)));
  return { deleted: true };
}

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
    return await pingProvider(provider.provider, baseUrl, apiKey, provider.model);
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
      const modelAvailable = data.data?.some((item) => item.id.includes(model.split("/").pop() ?? model));

      return {
        success: true,
        message: modelAvailable
          ? `Connected. Model "${model}" is available.`
          : `Connected. Model "${model}" not found in available models.`,
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
        message: "Connected to Anthropic API successfully",
        model,
      };
    }

    if (provider === "google") {
      const response = await fetch(`${baseUrl}/models?key=${apiKey}`, {
        method: "GET",
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
        message: "Connected to Google Generative Language API successfully",
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
