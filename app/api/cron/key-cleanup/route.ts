import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * API key cleanup — SOC 2 compliance.
 * Removes revoked platform keys older than 30 days
 * and expired platform keys older than 7 days.
 * Runs daily via Vercel Cron.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  // Remove revoked keys older than 30 days
  const revokedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const revoked = await sql`
    DELETE FROM api_keys
    WHERE revoked_at IS NOT NULL AND revoked_at < ${revokedCutoff}
    RETURNING id
  `;

  // Remove expired keys older than 7 days
  const expiredCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const expired = await sql`
    DELETE FROM api_keys
    WHERE expires_at IS NOT NULL AND expires_at < ${expiredCutoff} AND revoked_at IS NULL
    RETURNING id
  `;

  return NextResponse.json({
    ok: true,
    revoked_deleted: revoked.length,
    expired_deleted: expired.length,
    revoked_cutoff_days: 30,
    expired_cutoff_days: 7,
  });
}
