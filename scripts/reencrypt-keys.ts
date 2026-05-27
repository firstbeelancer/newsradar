import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Pool } from "pg";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function keyFromEnv(name: string): Buffer {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  const key = Buffer.from(value.toLowerCase(), "hex");
  if (key.length !== 32) {
    throw new Error(`${name} must be a 32-byte hex key`);
  }
  return key;
}

function decryptWithKey(ciphertext: string, key: Buffer): string {
  const [ivHex, encryptedHex, authTagHex] = ciphertext.split(":");
  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error("Invalid encrypted payload format");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const oldKey = keyFromEnv("OLD_ENCRYPTION_KEY");
  const newKey = keyFromEnv("ENCRYPTION_KEY");
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string; api_key_encrypted: string }>(
      `SELECT id, api_key_encrypted
       FROM ai_providers
       WHERE api_key_encrypted IS NOT NULL
         AND api_key_encrypted <> ''`
    );

    for (const row of rows) {
      const plaintext = decryptWithKey(row.api_key_encrypted, oldKey);
      const encrypted = encryptWithKey(plaintext, newKey);
      await client.query(
        `UPDATE ai_providers SET api_key_encrypted = $1, updated_at = NOW() WHERE id = $2`,
        [encrypted, row.id]
      );
    }

    await client.query("COMMIT");
    console.log(`Re-encrypted ${rows.length} AI provider key(s). Remove OLD_ENCRYPTION_KEY from env now.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
