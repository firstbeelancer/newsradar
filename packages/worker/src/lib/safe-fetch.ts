import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 1_500_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_USER_AGENT = "NewsRadar/1.0 (+https://newsradar.tigerapps.pro)";
type SafeHeadersInit = Headers | Record<string, string> | Array<[string, string]>;

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  headers?: SafeHeadersInit;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<ResolvedAddress[]>;
}

export interface SafeFetchTextResult {
  url: string;
  response: Response;
  text: string;
}

function normalizeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }

  url.hash = "";
  return url;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata.google.internal"
  );
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:169.254.")
  );
}

function isPrivateIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function defaultResolveHost(hostname: string): Promise<ResolvedAddress[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family }));
}

export async function validateSafeUrl(
  rawUrl: string,
  options: Pick<SafeFetchOptions, "resolveHost"> = {}
): Promise<URL> {
  const url = normalizeUrl(rawUrl);
  const hostname = url.hostname;

  if (isBlockedHostname(hostname)) {
    throw new Error(`Blocked host: ${hostname}`);
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`Blocked private IP: ${hostname}`);
    }
    return url;
  }

  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const addresses = await resolveHost(hostname);
  if (addresses.length === 0) {
    throw new Error(`DNS lookup returned no addresses for ${hostname}`);
  }

  const blocked = addresses.find((record) => isPrivateIp(record.address));
  if (blocked) {
    throw new Error(`Blocked private IP resolved for ${hostname}: ${blocked.address}`);
  }

  return url;
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`Response too large: ${contentLength} bytes`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error(`Response too large: exceeds ${maxBytes} bytes`);
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response too large: exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

function mergeHeaders(options: SafeFetchOptions): Headers {
  const headers = new Headers(options.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", options.userAgent ?? DEFAULT_USER_AGENT);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "*/*");
  }
  return headers;
}

export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchTextResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let url = await validateSafeUrl(rawUrl, options);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url.toString(), {
        method: options.method ?? "GET",
        headers: mergeHeaders(options),
        redirect: "manual",
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`Redirect without Location from ${url.toString()}`);
        }
        if (redirectCount === maxRedirects) {
          throw new Error(`Too many redirects for ${rawUrl}`);
        }
        url = await validateSafeUrl(new URL(location, url).toString(), options);
        continue;
      }

      const text = await readTextWithLimit(response, maxBytes);
      return { url: url.toString(), response, text };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Too many redirects for ${rawUrl}`);
}
