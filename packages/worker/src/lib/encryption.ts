import { createDecipheriv } from "crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;
const key = Buffer.from(env.ENCRYPTION_KEY.toLowerCase(), "hex");

export function decrypt(ciphertext: string): string {
  const [ivHex, encryptedHex, authTagHex] = ciphertext.split(":");
  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
