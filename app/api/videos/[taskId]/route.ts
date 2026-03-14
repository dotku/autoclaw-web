import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Proxy video from blob/original URL through autoclaw.jytech.us domain
// This allows TikTok domain verification to work
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT blob_url, video_url, original_url FROM generated_videos
    WHERE task_id = ${taskId} AND status = 'completed'
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const sourceUrl = rows[0].blob_url || rows[0].video_url || rows[0].original_url;
  if (!sourceUrl) {
    return NextResponse.json({ error: "Video URL not available" }, { status: 404 });
  }

  try {
    const videoRes = await fetch(sourceUrl);
    if (!videoRes.ok) {
      return NextResponse.json({ error: "Failed to fetch video" }, { status: 502 });
    }

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const contentLength = videoRes.headers.get("content-length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(videoRes.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Failed to stream video" }, { status: 500 });
  }
}
