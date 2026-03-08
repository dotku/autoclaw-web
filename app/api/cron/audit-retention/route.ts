import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Audit log retention policy — SOC 2 compliance.
 * Retains logs for 365 days, then deletes older entries.
 * Runs daily via Vercel Cron.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const retentionDays = 365;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await sql`
    DELETE FROM audit_logs
    WHERE created_at < ${cutoff}
    RETURNING id
  `;

  return NextResponse.json({
    ok: true,
    retention_days: retentionDays,
    cutoff,
    deleted_count: result.length,
  });
}
