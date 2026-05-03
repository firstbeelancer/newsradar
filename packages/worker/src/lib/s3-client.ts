/**
 * ------------------------------------------------------------------
 * S3 Client — upload/download for S3-compatible storage
 * ------------------------------------------------------------------
 * Uses native fetch (no AWS SDK) for minimal dependencies.
 * Supports: AWS S3, MinIO, Wasabi, DigitalOcean Spaces, etc.
 * ------------------------------------------------------------------
 */

import { env } from "../config/env.js";

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
}

/**
 * Get S3 configuration from environment variables.
 */
export function getS3Config(): S3Config {
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
  };
}

/**
 * Check if S3 is configured.
 */
export function isS3Configured(): boolean {
  const cfg = getS3Config();
  return !!(cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey);
}

/**
 * Build S3 URL for an object key.
 */
function buildObjectUrl(key: string, cfg: S3Config): string {
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");

  if (cfg.forcePathStyle && cfg.endpoint) {
    return `${cfg.endpoint}/${cfg.bucket}/${encodedKey}`;
  }
  // Virtual-hosted style
  if (cfg.endpoint) {
    return `${cfg.endpoint}/${encodedKey}`;
  }
  // AWS default
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${encodedKey}`;
}

/**
 * Build public URL for an object (if S3_PUBLIC_BASE_URL is set).
 */
export function buildPublicUrl(key: string, cfg?: S3Config): string {
  const config = cfg ?? getS3Config();
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/${encodedKey}`;
  }

  return buildObjectUrl(key, config);
}

/**
 * AWS Signature Version 4 signing.
 */
function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | Uint8Array | null,
  cfg: S3Config,
  service: string = "s3"
): Record<string, string> {
  const { accessKeyId, secretAccessKey, region } = cfg;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 credentials not configured");
  }

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, "")}Z`;

  const urlObj = new URL(url);
  const host = urlObj.host;

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const payloadHash = body
    ? hashSha256(typeof body === "string" ? body : new TextDecoder().decode(body))
    : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  const canonicalRequest = [
    method,
    urlObj.pathname,
    urlObj.searchParams.toString(),
    `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256Hex(signingKey, stringToSign);

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    Host: host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: authorizationHeader,
  };
}

/* ─── Crypto helpers (Web Crypto API) ─── */

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hashSha256(message: string): string {
  // Use Node.js crypto for synchronous hashing
  const { createHash } = require("crypto");
  return createHash("sha256").update(message).digest("hex");
}

function hmacSha256(key: Uint8Array, message: string): Uint8Array {
  const { createHmac } = require("crypto");
  const hmac = createHmac("sha256", key).update(message).digest();
  return new Uint8Array(hmac);
}

function hmacSha256Hex(key: Uint8Array, message: string): string {
  return Array.from(hmacSha256(key, message))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Uint8Array {
  const kDate = hmacSha256(new TextEncoder().encode(`AWS4${key}`), dateStamp);
  const kRegion = hmacSha256(kDate, regionName);
  const kService = hmacSha256(kRegion, serviceName);
  const kSigning = hmacSha256(kService, "aws4_request");
  return kSigning;
}

/* ─── Public API ─── */

/**
 * Upload data to S3.
 *
 * @param key — object key (path in bucket)
 * @param data — file content (string or Uint8Array)
 * @param contentType — MIME type
 * @returns Public URL of the uploaded object
 */
export async function uploadToS3(
  key: string,
  data: string | Uint8Array,
  contentType: string = "application/octet-stream"
): Promise<{ url: string; key: string }> {
  const cfg = getS3Config();
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const url = buildObjectUrl(key, cfg);
  const body = typeof data === "string" ? new TextEncoder().encode(data) : data;

  const headers = signRequest(
    "PUT",
    url,
    { "Content-Type": contentType },
    body,
    cfg
  );

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`S3 upload failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return { url: buildPublicUrl(key, cfg), key };
}

/**
 * Download data from S3.
 *
 * @param key — object key
 * @returns File content as string
 */
export async function downloadFromS3(key: string): Promise<string> {
  const cfg = getS3Config();
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const url = buildObjectUrl(key, cfg);

  const headers = signRequest("GET", url, {}, null, cfg);

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`S3 download failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return response.text();
}

/**
 * Delete an object from S3.
 *
 * @param key — object key
 */
export async function deleteFromS3(key: string): Promise<void> {
  const cfg = getS3Config();
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const url = buildObjectUrl(key, cfg);

  const headers = signRequest("DELETE", url, {}, null, cfg);

  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`S3 delete failed (${response.status}): ${errorText.slice(0, 500)}`);
  }
}
