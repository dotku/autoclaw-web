/**
 * Webhook notification system
 * Sends events to OpenClaw (or any configured webhook endpoint)
 * when key actions occur on the Vercel frontend.
 */

export type WebhookEvent =
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "agent.activated"
  | "agent.deactivated"
  | "agent.config_updated"
  | "blocker.resolved";

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

const WEBHOOK_URL = process.env.OPENCLAW_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET;

/**
 * Send a webhook notification to OpenClaw.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function sendWebhook(event: WebhookEvent, data: Record<string, unknown>) {
  if (!WEBHOOK_URL) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (WEBHOOK_SECRET) {
      headers["X-Webhook-Secret"] = WEBHOOK_SECRET;
    }

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`Webhook ${event} failed: ${res.status} ${res.statusText}`);
    }
  } catch (e) {
    console.error(`Webhook ${event} error:`, e);
  }
}
