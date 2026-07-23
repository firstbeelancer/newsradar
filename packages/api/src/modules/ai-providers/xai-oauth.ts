/**
 * xAI Grok OAuth — Hermes-compatible device-code flow against accounts.x.ai.
 * Uses SuperGrok / X Premium+ subscription instead of pay-as-you-go API key.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { aiProviders, xaiOauthConnections, workspaces } from "../../db/schema.js";
import { encrypt, decrypt } from "../../lib/encryption.js";
import { AppError } from "../../middleware/error-handler.js";

// Same public client as Hermes Agent (xAI shared OAuth client for Grok CLI / agents).
export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
export const XAI_OAUTH_DEVICE_CODE_URL = `${XAI_OAUTH_ISSUER}/oauth2/device/code`;
export const XAI_OAUTH_BASE_URL = "https://api.x.ai/v1";
export const XAI_OAUTH_DEFAULT_MODEL = "grok-4.5";
/** Refresh up to 1h early — tokens ~6h lifetime. */
export const XAI_ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 60 * 1000;

const PROCESS_ASSIGNMENTS = ["translation", "scoring", "generation", "deepsearch", "search"] as const;

async function assertWorkspaceOwner(userId: string, workspaceId: string) {
  const ws = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)),
  });
  if (!ws) throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
  return ws;
}

function validateXaiEndpoint(url: string, field: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(502, `Invalid xAI ${field}`, "XAI_OAUTH_ENDPOINT_INVALID");
  }
  if (parsed.protocol !== "https:") {
    throw new AppError(502, `xAI ${field} must be HTTPS`, "XAI_OAUTH_ENDPOINT_INVALID");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "x.ai" && host !== "auth.x.ai" && !host.endsWith(".x.ai")) {
    throw new AppError(502, `xAI ${field} host not allowed: ${host}`, "XAI_OAUTH_ENDPOINT_INVALID");
  }
}

async function discoverTokenEndpoint(): Promise<string> {
  const response = await fetch(XAI_OAUTH_DISCOVERY_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new AppError(502, `xAI OIDC discovery failed (${response.status})`, "XAI_DISCOVERY_FAILED");
  }
  const payload = (await response.json()) as { token_endpoint?: string };
  const tokenEndpoint = String(payload.token_endpoint || "").trim();
  if (!tokenEndpoint) {
    throw new AppError(502, "xAI OIDC discovery missing token_endpoint", "XAI_DISCOVERY_INCOMPLETE");
  }
  validateXaiEndpoint(tokenEndpoint, "token_endpoint");
  return tokenEndpoint;
}

async function requestDeviceCode() {
  const body = new URLSearchParams({
    client_id: XAI_OAUTH_CLIENT_ID,
    scope: XAI_OAUTH_SCOPE,
  });
  const response = await fetch(XAI_OAUTH_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new AppError(
      502,
      `xAI device-code request failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      "XAI_DEVICE_CODE_FAILED"
    );
  }
  const payload = (await response.json()) as Record<string, unknown>;
  const required = ["device_code", "user_code", "verification_uri", "expires_in", "interval"] as const;
  for (const key of required) {
    if (payload[key] == null || payload[key] === "") {
      throw new AppError(502, `xAI device-code missing ${key}`, "XAI_DEVICE_CODE_INVALID");
    }
  }
  return {
    deviceCode: String(payload.device_code),
    userCode: String(payload.user_code),
    verificationUri: String(payload.verification_uri),
    verificationUriComplete: String(payload.verification_uri_complete || payload.verification_uri),
    expiresIn: Number(payload.expires_in) || 600,
    interval: Math.max(1, Number(payload.interval) || 5),
  };
}

export async function getXaiOauthStatus(params: { userId: string; workspaceId: string }) {
  await assertWorkspaceOwner(params.userId, params.workspaceId);
  const row = await db.query.xaiOauthConnections.findFirst({
    where: eq(xaiOauthConnections.workspaceId, params.workspaceId),
  });
  if (!row) {
    return {
      status: "disconnected" as const,
      connected: false,
      userCode: null,
      verificationUri: null,
      verificationUriComplete: null,
      expiresAt: null,
      connectedAt: null,
      lastError: null,
      model: XAI_OAUTH_DEFAULT_MODEL,
      baseUrl: XAI_OAUTH_BASE_URL,
    };
  }

  const deviceExpired =
    row.status === "pending" &&
    row.deviceExpiresAt != null &&
    row.deviceExpiresAt.getTime() < Date.now();

  return {
    status: deviceExpired ? ("error" as const) : (row.status as string),
    connected: row.status === "connected" && Boolean(row.refreshTokenEncrypted),
    userCode: row.status === "pending" ? row.userCode : null,
    verificationUri: row.status === "pending" ? row.verificationUri : null,
    verificationUriComplete: row.status === "pending" ? row.verificationUriComplete : null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastError: deviceExpired ? "Время на ввод кода истекло. Запусти подключение заново." : row.lastError,
    model: XAI_OAUTH_DEFAULT_MODEL,
    baseUrl: row.baseUrl || XAI_OAUTH_BASE_URL,
  };
}

export async function startXaiOauth(params: { userId: string; workspaceId: string }) {
  await assertWorkspaceOwner(params.userId, params.workspaceId);
  const tokenEndpoint = await discoverTokenEndpoint();
  const device = await requestDeviceCode();
  const deviceExpiresAt = new Date(Date.now() + device.expiresIn * 1000);

  const existing = await db.query.xaiOauthConnections.findFirst({
    where: eq(xaiOauthConnections.workspaceId, params.workspaceId),
  });

  const values = {
    userId: params.userId,
    status: "pending" as const,
    deviceCode: device.deviceCode,
    userCode: device.userCode,
    verificationUri: device.verificationUri,
    verificationUriComplete: device.verificationUriComplete,
    deviceIntervalSec: device.interval,
    deviceExpiresAt,
    accessTokenEncrypted: null as string | null,
    refreshTokenEncrypted: null as string | null,
    idTokenEncrypted: null as string | null,
    expiresAt: null as Date | null,
    tokenEndpoint,
    baseUrl: XAI_OAUTH_BASE_URL,
    lastError: null as string | null,
    connectedAt: null as Date | null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(xaiOauthConnections)
      .set(values)
      .where(eq(xaiOauthConnections.id, existing.id));
  } else {
    await db.insert(xaiOauthConnections).values({
      workspaceId: params.workspaceId,
      ...values,
    });
  }

  return {
    status: "pending" as const,
    userCode: device.userCode,
    verificationUri: device.verificationUri,
    verificationUriComplete: device.verificationUriComplete,
    expiresIn: device.expiresIn,
    interval: device.interval,
    instructions:
      "Открой ссылку, войди в SuperGrok / X Premium+ и подтверди код. Затем нажми «Проверить вход».",
  };
}

async function exchangeDeviceCode(params: {
  tokenEndpoint: string;
  deviceCode: string;
}): Promise<
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; pending: true; slowDown?: boolean }
  | { ok: false; pending: false; error: string }
> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: XAI_OAUTH_CLIENT_ID,
    device_code: params.deviceCode,
  });
  const response = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (response.status === 200) {
    const payload = (await response.json()) as Record<string, unknown>;
    if (!payload.access_token || !payload.refresh_token) {
      return { ok: false, pending: false, error: "Ответ xAI без access/refresh token" };
    }
    return { ok: true, payload };
  }

  let errorPayload: Record<string, unknown> = {};
  try {
    errorPayload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, pending: false, error: `xAI poll HTTP ${response.status}` };
  }
  const errorCode = String(errorPayload.error || "");
  if (errorCode === "authorization_pending") {
    return { ok: false, pending: true };
  }
  if (errorCode === "slow_down") {
    return { ok: false, pending: true, slowDown: true };
  }
  const description =
    String(errorPayload.error_description || errorPayload.error || "").trim() ||
    `xAI poll failed (${response.status})`;
  return { ok: false, pending: false, error: description };
}

async function upsertGrokOauthProvider(workspaceId: string) {
  const existing = await db.query.aiProviders.findMany({
    where: eq(aiProviders.workspaceId, workspaceId),
  });
  const oauthRow = existing.find((p) => p.provider === "xai" && p.type === "oauth");
  // Marker key — real bearer comes from xai_oauth_connections at runtime.
  const marker = encrypt("xai-oauth-managed");

  if (oauthRow) {
    await db
      .update(aiProviders)
      .set({
        name: "Grok (SuperGrok OAuth)",
        isActive: true,
        model: XAI_OAUTH_DEFAULT_MODEL,
        baseUrl: XAI_OAUTH_BASE_URL,
        apiKeyEncrypted: marker,
        assignedTo: [...PROCESS_ASSIGNMENTS],
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, oauthRow.id));
    return oauthRow.id;
  }

  // Deactivate other process assignments conflict lightly: keep existing byok
  // but prefer oauth by making it active and assigning processes.
  const [created] = await db
    .insert(aiProviders)
    .values({
      workspaceId,
      name: "Grok (SuperGrok OAuth)",
      type: "oauth",
      provider: "xai",
      baseUrl: XAI_OAUTH_BASE_URL,
      apiKeyEncrypted: marker,
      model: XAI_OAUTH_DEFAULT_MODEL,
      isActive: true,
      assignedTo: [...PROCESS_ASSIGNMENTS],
    })
    .returning({ id: aiProviders.id });

  return created.id;
}

export async function pollXaiOauth(params: { userId: string; workspaceId: string }) {
  await assertWorkspaceOwner(params.userId, params.workspaceId);
  const row = await db.query.xaiOauthConnections.findFirst({
    where: eq(xaiOauthConnections.workspaceId, params.workspaceId),
  });
  if (!row) {
    throw new AppError(400, "Сначала нажми «Подключить Grok»", "XAI_OAUTH_NOT_STARTED");
  }
  if (row.status === "connected" && row.refreshTokenEncrypted) {
    return getXaiOauthStatus(params);
  }
  if (row.status !== "pending" || !row.deviceCode || !row.tokenEndpoint) {
    throw new AppError(400, "Нет активного device-code. Запусти подключение заново.", "XAI_OAUTH_NOT_PENDING");
  }
  if (row.deviceExpiresAt && row.deviceExpiresAt.getTime() < Date.now()) {
    await db
      .update(xaiOauthConnections)
      .set({
        status: "error",
        lastError: "Время на ввод кода истекло. Запусти подключение заново.",
        updatedAt: new Date(),
      })
      .where(eq(xaiOauthConnections.id, row.id));
    throw new AppError(400, "Время на ввод кода истекло", "XAI_OAUTH_DEVICE_EXPIRED");
  }

  const result = await exchangeDeviceCode({
    tokenEndpoint: row.tokenEndpoint,
    deviceCode: row.deviceCode,
  });

  if (!result.ok && result.pending) {
    return {
      ...(await getXaiOauthStatus(params)),
      status: "pending" as const,
      waiting: true,
      slowDown: Boolean(result.slowDown),
    };
  }

  if (!result.ok) {
    await db
      .update(xaiOauthConnections)
      .set({
        status: "error",
        lastError: result.error,
        updatedAt: new Date(),
      })
      .where(eq(xaiOauthConnections.id, row.id));
    throw new AppError(400, result.error, "XAI_OAUTH_DENIED");
  }

  const accessToken = String(result.payload.access_token || "");
  const refreshToken = String(result.payload.refresh_token || "");
  const idToken = String(result.payload.id_token || "");
  const expiresIn = Number(result.payload.expires_in) || 6 * 60 * 60;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const now = new Date();

  await db
    .update(xaiOauthConnections)
    .set({
      status: "connected",
      accessTokenEncrypted: encrypt(accessToken),
      refreshTokenEncrypted: encrypt(refreshToken),
      idTokenEncrypted: idToken ? encrypt(idToken) : null,
      tokenType: String(result.payload.token_type || "Bearer"),
      expiresAt,
      deviceCode: null,
      userCode: null,
      verificationUri: null,
      verificationUriComplete: null,
      deviceExpiresAt: null,
      lastError: null,
      connectedAt: now,
      updatedAt: now,
    })
    .where(eq(xaiOauthConnections.id, row.id));

  await upsertGrokOauthProvider(params.workspaceId);

  return {
    status: "connected" as const,
    connected: true,
    waiting: false,
    expiresAt: expiresAt.toISOString(),
    connectedAt: now.toISOString(),
    model: XAI_OAUTH_DEFAULT_MODEL,
    baseUrl: XAI_OAUTH_BASE_URL,
    message: "Grok подключён через подписку SuperGrok / X Premium+. Можно назначать на перевод, скоринг, генерацию.",
  };
}

export async function disconnectXaiOauth(params: { userId: string; workspaceId: string }) {
  await assertWorkspaceOwner(params.userId, params.workspaceId);
  const row = await db.query.xaiOauthConnections.findFirst({
    where: eq(xaiOauthConnections.workspaceId, params.workspaceId),
  });
  if (row) {
    await db
      .update(xaiOauthConnections)
      .set({
        status: "disconnected",
        deviceCode: null,
        userCode: null,
        verificationUri: null,
        verificationUriComplete: null,
        deviceExpiresAt: null,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        idTokenEncrypted: null,
        expiresAt: null,
        lastError: null,
        connectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(xaiOauthConnections.id, row.id));
  }

  const providers = await db.query.aiProviders.findMany({
    where: eq(aiProviders.workspaceId, params.workspaceId),
  });
  for (const p of providers) {
    if (p.provider === "xai" && p.type === "oauth") {
      await db
        .update(aiProviders)
        .set({ isActive: false, assignedTo: [], updatedAt: new Date() })
        .where(eq(aiProviders.id, p.id));
    }
  }

  return { disconnected: true };
}

/** Used by worker via shared DB table — refresh helper exported for API test. */
export async function refreshXaiOauthTokens(params: {
  refreshToken: string;
  tokenEndpoint?: string | null;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
}> {
  const endpoint = (params.tokenEndpoint || "").trim() || (await discoverTokenEndpoint());
  validateXaiEndpoint(endpoint, "token_endpoint");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: XAI_OAUTH_CLIENT_ID,
    refresh_token: params.refreshToken,
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403) {
      throw new AppError(
        403,
        "xAI OAuth 403: подписка не даёт API access. Нужен SuperGrok tier с API/OAuth или XAI_API_KEY.",
        "XAI_OAUTH_TIER_DENIED"
      );
    }
    throw new AppError(
      401,
      `xAI token refresh failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      "XAI_OAUTH_REFRESH_FAILED"
    );
  }
  const payload = (await response.json()) as Record<string, unknown>;
  const accessToken = String(payload.access_token || "").trim();
  if (!accessToken) {
    throw new AppError(401, "xAI refresh missing access_token", "XAI_OAUTH_REFRESH_INVALID");
  }
  return {
    accessToken,
    refreshToken: String(payload.refresh_token || params.refreshToken).trim(),
    idToken: String(payload.id_token || "").trim() || undefined,
    expiresIn: Number(payload.expires_in) || 6 * 60 * 60,
    tokenType: String(payload.token_type || "Bearer"),
  };
}

export function decryptToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

export { encrypt as encryptToken };
