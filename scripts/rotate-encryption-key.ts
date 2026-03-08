/**
 * ENCRYPTION_KEY rotation script — SOC 2 compliance.
 *
 * Re-encrypts all user_api_keys with a new encryption key.
 *
 * Usage:
 *   OLD_KEY=<old_hex> NEW_KEY=<new_hex> npx tsx web/scripts/rotate-encryption-key.ts
 *
 * After running, update ENCRYPTION_KEY in .env.local and production env to NEW_KEY.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import postgres from "postgres";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decryptWithKey(encoded: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const data = Buffer.from(encoded, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}

function encryptWithKey(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

async function main() {
  const oldKey = process.env.OLD_KEY;
  const newKey = process.env.NEW_KEY;

  if (!oldKey || oldKey.length !== 64) {
    console.error("OLD_KEY must be a 64-char hex string");
    process.exit(1);
  }
  if (!newKey || newKey.length !== 64) {
    console.error("NEW_KEY must be a 64-char hex string");
    process.exit(1);
  }
  if (oldKey === newKey) {
    console.error("OLD_KEY and NEW_KEY must be different");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = postgres(dbUrl);

  try {
    const rows = await sql`SELECT id, api_key FROM user_api_keys`;
    console.log(`Found ${rows.length} keys to rotate`);

    let rotated = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        // Try to decrypt with old key
        const plaintext = decryptWithKey(row.api_key, oldKey);
        // Re-encrypt with new key
        const newEncrypted = encryptWithKey(plaintext, newKey);
        await sql`UPDATE user_api_keys SET api_key = ${newEncrypted}, updated_at = NOW() WHERE id = ${row.id}`;
        rotated++;
      } catch {
        // May be legacy plaintext — encrypt with new key
        try {
          const newEncrypted = encryptWithKey(row.api_key, newKey);
          await sql`UPDATE user_api_keys SET api_key = ${newEncrypted}, updated_at = NOW() WHERE id = ${row.id}`;
          rotated++;
          console.log(`  Key ${row.id}: encrypted legacy plaintext`);
        } catch (e) {
          console.error(`  Key ${row.id}: FAILED - ${e}`);
          skipped++;
        }
      }
    }

    console.log(`\nDone: ${rotated} rotated, ${skipped} skipped`);
    console.log("Update ENCRYPTION_KEY in .env.local and production to NEW_KEY.");
  } finally {
    await sql.end();
  }
}

main();
