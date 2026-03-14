import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const SAMPLE_TEXT: Record<string, string> = {
  alloy: "Hi, I'm Alloy. I have a balanced and versatile voice.",
  echo: "Hi, I'm Echo. I have a warm and resonant voice.",
  fable: "Hi, I'm Fable. I have an expressive and narrative voice.",
  onyx: "Hi, I'm Onyx. I have a deep and authoritative voice.",
  nova: "Hi, I'm Nova. I have a friendly and energetic voice.",
  shimmer: "Hi, I'm Shimmer. I have a clear and bright voice.",
};

export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get("voice");
  if (!voice || !VOICES.includes(voice)) {
    return NextResponse.json({ error: "Invalid voice" }, { status: 400 });
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

  // Try OpenAI key from BYOK
  const keys = await sql`
    SELECT api_key FROM user_api_keys WHERE user_id = ${users[0].id} AND service = 'openai' LIMIT 1
  `;
  if (keys.length === 0) {
    return NextResponse.json({ error: "OpenAI API key not configured. Add it in Settings." }, { status: 400 });
  }

  const openaiKey = decrypt(keys[0].api_key);

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: SAMPLE_TEXT[voice],
        voice,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI TTS error:", err);
      return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
    }

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("TTS sample error:", err);
    return NextResponse.json({ error: "Failed to generate sample" }, { status: 500 });
  }
}
