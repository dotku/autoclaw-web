import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORKER_URL = process.env.WORKER_URL || "https://autoclaw-worker.dotku.workers.dev";
const WORKER_AUTH_SECRET = process.env.WORKER_AUTH_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Vercel Cron endpoint — calls Worker /cron to advance all active agent tasks.
 * Runs every 30 minutes via vercel.json.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!WORKER_AUTH_SECRET) {
    return NextResponse.json({ error: "WORKER_AUTH_SECRET not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${WORKER_URL}/cron`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_AUTH_SECRET}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      worker_status: res.status,
      ...data,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to call worker: ${e}` },
      { status: 502 }
    );
  }
}
