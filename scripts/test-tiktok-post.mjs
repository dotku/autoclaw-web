#!/usr/bin/env node
/**
 * Test TikTok posting via Content Posting API (FILE_UPLOAD method)
 * Usage: node --env-file=.env.local scripts/test-tiktok-post.mjs
 */

import { neon } from "@neondatabase/serverless";
import { createWriteStream, statSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || "sbawg8ocnk6tzdia9g";
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || "cUrsj5UaKyq0qXNH6n2n13rY7Xd1CO8u";

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/test-tiktok-post.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function getToken() {
  const tokens = await sql`SELECT * FROM tiktok_tokens ORDER BY updated_at DESC LIMIT 1`;
  if (tokens.length === 0) {
    console.error("No TikTok tokens found.");
    process.exit(1);
  }

  const token = tokens[0];
  console.log("Found token for open_id:", token.open_id);
  console.log("Scope:", token.scope);

  if (new Date(token.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    console.log("Token expired, refreshing...");
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      console.error("Refresh failed:", data);
      process.exit(1);
    }
    await sql`
      UPDATE tiktok_tokens SET
        access_token = ${data.access_token},
        refresh_token = ${data.refresh_token},
        expires_at = ${new Date(Date.now() + data.expires_in * 1000)},
        updated_at = NOW()
      WHERE id = ${token.id}
    `;
    return data.access_token;
  }

  return token.access_token;
}

async function downloadVideo(url, dest) {
  console.log("Downloading sample video...");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("fs");
  writeFileSync(dest, buffer);
  console.log("Downloaded to:", dest, "Size:", buffer.length, "bytes");
  return buffer.length;
}

async function postVideo(accessToken) {
  const title = "xPilot - AI Social Media Copilot #xPilot #AIMarketing";

  // Download a small sample video
  const videoPath = join(tmpdir(), "tiktok-test-video.mp4");
  const videoSize = await downloadVideo(
    "https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4",
    videoPath
  );

  console.log("\nInitializing upload...");
  console.log("Title:", title);
  console.log("Privacy: SELF_ONLY\n");

  // Step 1: Init upload
  const initRes = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    }
  );

  const initData = await initRes.json();
  console.log("Init response:", JSON.stringify(initData, null, 2));

  if (initData.error?.code) {
    console.error("Init failed:", initData.error);
    return;
  }

  const uploadUrl = initData.data?.upload_url;
  const publishId = initData.data?.publish_id;

  if (!uploadUrl) {
    console.error("No upload URL returned");
    return;
  }

  // Step 2: Upload video file
  console.log("\nUploading video...");
  const videoBuffer = readFileSync(videoPath);

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
      "Content-Type": "video/mp4",
    },
    body: videoBuffer,
  });

  console.log("Upload status:", uploadRes.status);

  // Step 3: Check publish status
  console.log("\nChecking publish status in 5 seconds...");
  await new Promise((r) => setTimeout(r, 5000));

  const statusRes = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: publishId }),
    }
  );

  const statusData = await statusRes.json();
  console.log("Publish Status:", JSON.stringify(statusData, null, 2));
}

async function main() {
  try {
    const accessToken = await getToken();
    await postVideo(accessToken);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
