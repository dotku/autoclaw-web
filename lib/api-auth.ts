import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getDb } from "@/lib/db";

interface ApiKeyPayload {
  userId: number;
  keyId: number;
  scopes: string[];
}

/**
 * Validates a platform API key from the Authorization header.
 * Updates last_used_at on successful validation.
 * Returns the key payload or null if invalid.
 */
export async function validateApiKey(req: NextRequest): Promise<ApiKeyPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ac_live_")) return null;

  const rawKey = authHeader.slice(7); // Remove "Bearer "
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const sql = getDb();
  const rows = await sql`
    SELECT id, user_id, scopes, expires_at, revoked_at
    FROM api_keys
    WHERE key_hash = ${keyHash}
  `;

  if (rows.length === 0) return null;

  const key = rows[0];

  // Check revocation
  if (key.revoked_at) return null;

  // Check expiration
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;

  // Update last_used_at (fire-and-forget)
  sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${key.id}`.catch(() => {});

  return {
    userId: key.user_id as number,
    keyId: key.id as number,
    scopes: key.scopes as string[],
  };
}

/**
 * Checks if the given scopes include the required scope.
 */
export function hasScope(scopes: string[], required: string): boolean {
  if (scopes.includes("admin")) return true;
  return scopes.includes(required);
}

/**
 * Helper: returns 403 response for insufficient permissions.
 */
export function forbiddenResponse() {
  return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
}
