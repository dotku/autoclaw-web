import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;
  const users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ logs: [] });
  }

  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 100);

  const logs = isAdmin
    ? await sql`SELECT id, user_email, action, resource_type, resource_id, details, ip_address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ${limit}`
    : await sql`SELECT id, user_email, action, resource_type, resource_id, details, created_at FROM audit_logs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;

  return NextResponse.json({ logs });
}
