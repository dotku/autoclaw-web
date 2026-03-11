import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDb, resolveUserPlan } from "@/lib/db";

export interface ApiContext {
  userId: number;
  keyId: number;
  scopes: string[];
  plan: string;
  sql: ReturnType<typeof getDb>;
}

/**
 * Authenticate and authorize a v1 API request.
 * Returns either an ApiContext or an error NextResponse.
 */
export async function authenticateV1(
  req: NextRequest,
  requiredScope: "read" | "write" | "admin",
): Promise<ApiContext | NextResponse> {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Validate API key
  const payload = await validateApiKey(req);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired API key" }, { status: 401 });
  }

  // Check scope
  if (!hasScope(payload.scopes, requiredScope)) {
    return NextResponse.json(
      { error: `Insufficient scope. Required: ${requiredScope}` },
      { status: 403 },
    );
  }

  const sql = getDb();

  // Resolve user plan
  const users = await sql`SELECT plan, email FROM users WHERE id = ${payload.userId}`;
  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const email = users[0].email as string;
  const plan = await resolveUserPlan(sql, payload.userId, (users[0].plan as string) || "starter", email);

  return {
    userId: payload.userId,
    keyId: payload.keyId,
    scopes: payload.scopes,
    plan,
    sql,
  };
}

/**
 * Standard error response helper.
 */
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response with optional pagination metadata.
 */
export function apiSuccess(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Parse pagination params from query string.
 */
export function parsePagination(req: NextRequest): { limit: number; offset: number } {
  const url = req.nextUrl;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20"), 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
  return { limit, offset };
}
