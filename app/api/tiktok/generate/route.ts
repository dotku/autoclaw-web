import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function getXpilotKey(userId: number): Promise<string | null> {
  const sql = getDb();
  const keys = await sql`
    SELECT encrypted_key FROM api_keys WHERE user_id = ${userId} AND service = 'xpilot' AND revoked_at IS NULL LIMIT 1
  `;
  if (keys.length === 0) return null;
  return decrypt(keys[0].encrypted_key);
}

// POST: Generate video via xPilot API
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const allowed = checkRateLimit(ip, { limit: 5, windowMs: 60000 });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const sub = session.user.sub;
  const users = await sql`SELECT id FROM users WHERE auth0_id = ${sub} LIMIT 1`;
  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const xpilotKey = await getXpilotKey(users[0].id);
  if (!xpilotKey) {
    return NextResponse.json(
      { error: "xPilot API key not configured. Add it in Settings > Market." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { prompt, duration = 4 } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://xpilot.jytech.us/api/v1/video/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xpilotKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        duration,
        aspect_ratio: "9:16",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "xPilot API error", details: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      taskId: data.taskId || data.task_id,
      provider: data.provider,
      message: "Video generation started",
    });
  } catch (err) {
    console.error("xPilot video generation error:", err);
    return NextResponse.json({ error: "Failed to generate video" }, { status: 500 });
  }
}

// GET: Poll video generation status
export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  const provider = req.nextUrl.searchParams.get("provider");

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const sql = getDb();
  const sub = session.user.sub;
  const users = await sql`SELECT id FROM users WHERE auth0_id = ${sub} LIMIT 1`;
  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const xpilotKey = await getXpilotKey(users[0].id);
  if (!xpilotKey) {
    return NextResponse.json({ error: "xPilot API key not configured" }, { status: 400 });
  }

  try {
    const providerParam = provider ? `?provider=${provider}` : "";
    const res = await fetch(
      `https://xpilot.jytech.us/api/v1/video/${taskId}${providerParam}`,
      {
        headers: { Authorization: `Bearer ${xpilotKey}` },
      }
    );

    const data = await res.json();

    return NextResponse.json({
      status: data.status,
      videoUrl: data.output?.video_url || data.videoUrl || data.video_url,
      progress: data.progress,
    });
  } catch (err) {
    console.error("xPilot status poll error:", err);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
