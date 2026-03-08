/**
 * Webhook notification system
 * Sends events to OpenClaw (or any configured webhook endpoint)
 * when key actions occur on the Vercel frontend.
 *
 * Security: HMAC-SHA256 signature in X-Webhook-Signature header.
 * The receiver should recompute the signature and compare.
 */

import { createHmac } from "crypto";

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
 * Compute HMAC-SHA256 signature for a payload string.
 */
function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

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
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (WEBHOOK_SECRET) {
      headers["X-Webhook-Signature"] = `sha256=${sign(body, WEBHOOK_SECRET)}`;
    }

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`Webhook ${event} failed: ${res.status} ${res.statusText}`);
    }
  } catch (e) {
    console.error(`Webhook ${event} error:`, e);
  }
}

/**
 * Verify a webhook signature (for use on the receiving side).
 * Returns true if the signature matches.
 */
export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${sign(body, secret)}`;
  if (expected.length !== signature.length) return false;
  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
