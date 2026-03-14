import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { decrypt } from "@/lib/crypto";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function getUserKey(userId: number, service: string): Promise<string | null> {
  const sql = getDb();
  const keys = await sql`
    SELECT api_key FROM user_api_keys WHERE user_id = ${userId} AND service = ${service} LIMIT 1
  `;
  if (keys.length === 0) return null;
  return decrypt(keys[0].api_key);
}

const TEXT_TO_VIDEO_MODELS = [
  { id: "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast", label: "Wan 2.2 — 480p Ultra Fast", tier: "fast" },
  { id: "wavespeed-ai/wan-2.2/t2v-720p", label: "Wan 2.2 — 720p", tier: "standard" },
  { id: "alibaba/wan-2.6/text-to-video", label: "Wan 2.6 Audio", tier: "standard" },
  { id: "bytedance/seedance-v1.5-pro/text-to-video", label: "Seedance 1.5 Pro Audio", tier: "premium" },
  { id: "kwaivgi/kling-video-o3-std/text-to-video", label: "Kling Video O3", tier: "premium" },
  { id: "seedance-2.0/text-to-video", label: "Seedance 2.0 Audio", tier: "premium" },
];

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

  const userId = users[0].id;
  const xpilotKey = await getUserKey(userId, "xpilot");
  if (!xpilotKey) {
    return NextResponse.json(
      { error: "xPilot API key not configured. Add it in Settings > Market." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { prompt, duration = 5, model = "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast" } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  // Validate model
  const validModel = TEXT_TO_VIDEO_MODELS.find((m) => m.id === model);
  if (!validModel) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  try {
    const res = await fetch("https://xpilot.jytech.us/api/v1/video/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xpilotKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        duration,
        aspect_ratio: "9:16",
      }),
    });

    const data = await res.json();
    console.log("xPilot video generate response:", res.status, JSON.stringify(data));

    if (!res.ok) {
      const errMsg = typeof data.error === "string"
        ? data.error
        : (data.error?.message || data.message || (Object.keys(data).length > 0 ? JSON.stringify(data) : `xPilot returned ${res.status} with no details`));
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    return NextResponse.json({
      taskId: data.taskId || data.task_id || data.id,
      provider: data.provider,
      message: "Video generation started",
    });
  } catch (err) {
    console.error("xPilot video generation error:", err);
    return NextResponse.json({ error: "Failed to generate video" }, { status: 500 });
  }
}

// GET: Poll video status or list models
export async function GET(req: NextRequest) {
  const listModels = req.nextUrl.searchParams.get("listModels");
  if (listModels === "true") {
    return NextResponse.json({ models: TEXT_TO_VIDEO_MODELS });
  }

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

  const userId = users[0].id;
  const xpilotKey = await getUserKey(userId, "xpilot");
  if (!xpilotKey) {
    return NextResponse.json({ error: "xPilot API key not configured" }, { status: 400 });
  }

  try {
    const providerParam = provider ? `?provider=${provider}` : "";
    const res = await fetch(
      `https://xpilot.jytech.us/api/v1/video/${taskId}${providerParam}`,
      { headers: { Authorization: `Bearer ${xpilotKey}` } }
    );

    const data = await res.json();
    console.log("xPilot video status:", res.status, JSON.stringify(data));

    const videoUrl = data.output?.video_url || data.videoUrl || data.video_url || data.output?.url;

    // If completed and has video URL, save to Vercel Blob
    if (data.status === "completed" && videoUrl) {
      const blobToken = await getUserKey(userId, "blob_token");
      if (blobToken) {
        try {
          const videoRes = await fetch(videoUrl);
          if (videoRes.ok) {
            const videoBlob = await videoRes.blob();
            const filename = `tiktok-videos/${taskId}.mp4`;
            const blob = await put(filename, videoBlob, {
              access: "public",
              contentType: "video/mp4",
              token: blobToken,
            });
            return NextResponse.json({
              status: "completed",
              videoUrl: blob.url,
              originalUrl: videoUrl,
            });
          }
        } catch (blobErr) {
          console.warn("Failed to save to Vercel Blob, using original URL:", blobErr);
        }
      }
      return NextResponse.json({ status: "completed", videoUrl });
    }

    return NextResponse.json({
      status: data.status,
      videoUrl,
      progress: data.progress,
    });
  } catch (err) {
    console.error("xPilot status poll error:", err);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
