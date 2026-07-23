/**
 * Resolve Grok OAuth access token for a workspace (SuperGrok / X Premium+).
 * Hermes-compatible refresh against auth.x.ai.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { xaiOauthConnections } from "../db/schema.js";

const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_OAUTH_DISCOVERY_URL = "https://auth.x.ai/.well-known/openid-configuration";
const XAI_OAUTH_BASE_URL = "https://api.x.ai/v1";
const REFRESH_SKEW_MS = 60 * 60 * 1000;

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;
const key = Buffer.from(env.ENCRYPTION_KEY.toLowerCase(), "hex");

function decryptLocal(ciphertext: string): string {
  const [ivHex, encryptedHex, authTagHex] = ciphertext.split(":");
  if (!ivHex || !encryptedHex || !authTagHex) throw new Error("Invalid encrypted payload");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function encryptLocal(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

async function discoverTokenEndpoint(): Promise<string> {
  const response = await fetch(XAI_OAUTH_DISCOVERY_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`xAI discovery failed: ${response.status}`);
  const payload = (await response.json()) as { token_endpoint?: string };
  const endpoint = String(payload.token_endpoint || "").trim();
  if (!endpoint.startsWith("https://")) throw new Error("Invalid xAI token endpoint");
  return endpoint;
}

async function refreshTokens(refreshToken: string, tokenEndpoint?: string | null) {
  const endpoint = (tokenEndpoint || "").trim() || (await discoverTokenEndpoint());
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: XAI_OAUTH_CLIENT_ID,
    refresh_token: refreshToken,
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
    throw new Error(`xAI OAuth refresh failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const payload = (await response.json()) as Record<string, unknown>;
  const accessToken = String(payload.access_token || "").trim();
  if (!accessToken) throw new Error("xAI refresh missing access_token");
  return {
    accessToken,
    refreshToken: String(payload.refresh_token || refreshToken).trim(),
    idToken: String(payload.id_token || "").trim(),
    expiresIn: Number(payload.expires_in) || 6 * 60 * 60,
    tokenEndpoint: endpoint,
  };
}

export async function resolveWorkspaceXaiOauthCredentials(
  workspaceId: string
): Promise<{ apiKey: string; baseUrl: string; modelHint?: string } | null> {
  const rows = await db
    .select()
    .from(xaiOauthConnections)
    .where(eq(xaiOauthConnections.workspaceId, workspaceId))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "connected" || !row.refreshTokenEncrypted) {
    return null;
  }

  let accessToken = row.accessTokenEncrypted ? decryptLocal(row.accessTokenEncrypted) : "";
  const refreshToken = decryptLocal(row.refreshTokenEncrypted);
  const expiresAt = row.expiresAt?.getTime() ?? 0;
  const needsRefresh = !accessToken || expiresAt - Date.now() < REFRESH_SKEW_MS;

  if (needsRefresh) {
    try {
      const refreshed = await refreshTokens(refreshToken, row.tokenEndpoint);
      accessToken = refreshed.accessToken;
      const expiresAtDate = new Date(Date.now() + refreshed.expiresIn * 1000);
      await db
        .update(xaiOauthConnections)
        .set({
          accessTokenEncrypted: encryptLocal(refreshed.accessToken),
          refreshTokenEncrypted: encryptLocal(refreshed.refreshToken),
          idTokenEncrypted: refreshed.idToken ? encryptLocal(refreshed.idToken) : row.idTokenEncrypted,
          expiresAt: expiresAtDate,
          tokenEndpoint: refreshed.tokenEndpoint,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(xaiOauthConnections.id, row.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(xaiOauthConnections)
        .set({ lastError: message, updatedAt: new Date() })
        .where(eq(xaiOauthConnections.id, row.id));
      throw err;
    }
  }

  return {
    apiKey: accessToken,
    baseUrl: row.baseUrl || XAI_OAUTH_BASE_URL,
    modelHint: "grok-3-mini",
  };
}

export function isXaiOauthMarkerKey(apiKey: string): boolean {
  return apiKey === "xai-oauth-managed" || apiKey.startsWith("xai-oauth");
}
