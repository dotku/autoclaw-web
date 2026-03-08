import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Vercel Cron endpoint — polls Neon DB for recent changes
 * and re-sends webhooks to OpenClaw as a fallback.
 *
 * Checks audit_logs for events in the last 10 minutes that
 * may have been missed by the fire-and-forget webhook.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // last 10 min

  // Find recent audit events that correspond to webhook-worthy actions
  const recentEvents = await sql`
    SELECT action, resource_type, resource_id, user_email, details, created_at
    FROM audit_logs
    WHERE created_at >= ${since}
      AND action IN (
        'project.create', 'project.update', 'project.delete',
        'agent.activate', 'agent.deactivate', 'agent.config_update',
        'blocker.resolve'
      )
    ORDER BY created_at ASC
  `;

  let sent = 0;

  for (const evt of recentEvents) {
    const details = (evt.details as Record<string, unknown>) || {};

    const eventMap: Record<string, string> = {
      "project.create": "project.created",
      "project.update": "project.updated",
      "project.delete": "project.deleted",
      "agent.activate": "agent.activated",
      "agent.deactivate": "agent.deactivated",
      "agent.config_update": "agent.config_updated",
      "blocker.resolve": "blocker.resolved",
    };

    const webhookEvent = eventMap[evt.action as string];
    if (!webhookEvent) continue;

    await sendWebhook(webhookEvent as Parameters<typeof sendWebhook>[0], {
      ...details,
      resource_id: evt.resource_id,
      user_email: evt.user_email,
      source: "cron_sync",
    });
    sent++;
  }

  return NextResponse.json({
    ok: true,
    checked_since: since,
    events_found: recentEvents.length,
    webhooks_sent: sent,
  });
}
