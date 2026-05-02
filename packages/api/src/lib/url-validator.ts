import { z } from "zod";
import { URL } from "url";

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "[::]",
];

const BLOCKED_CIDRS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
];

const METADATA_ENDPOINTS = [
  "169.254.169.254",
  "metadata.google.internal",
  "metadata",
];

function isPrivateIP(ip: string): boolean {
  return BLOCKED_CIDRS.some((re) => re.test(ip));
}

export function validateUrl(input: string): { valid: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, reason: "Only HTTP and HTTPS protocols are allowed" };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.includes(hostname)) {
    return { valid: false, reason: "Blocked host" };
  }

  if (METADATA_ENDPOINTS.includes(hostname)) {
    return { valid: false, reason: "Metadata endpoints are blocked" };
  }

  if (isPrivateIP(hostname)) {
    return { valid: false, reason: "Private IP ranges are blocked" };
  }

  return { valid: true };
}

export const urlSchema = z
  .string()
  .url()
  .refine((val) => validateUrl(val).valid, {
    message: "URL points to a blocked or internal resource",
  });
