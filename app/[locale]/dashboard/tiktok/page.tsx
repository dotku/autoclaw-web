"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import DashboardShell from "@/components/DashboardShell";

interface TikTokStatus {
  connected: boolean;
  openId?: string;
  expiresAt?: string;
  scope?: string;
  authUrl?: string;
}

export default function TikTokPage() {
  const { user } = useUser();
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const t = dict.tiktokPage;

  const [status, setStatus] = useState<TikTokStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [privacy, setPrivacy] = useState("SELF_ONLY");

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/tiktok/post");
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      } else if (res.status === 401) {
        setStatus({ connected: false });
      } else {
        setStatus({ connected: false, authUrl: data.authUrl });
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (!videoTitle || !videoUrl) return;
    setPosting(true);
    setMessage("");
    try {
      const res = await fetch("/api/tiktok/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoTitle,
          videoUrl,
          privacyLevel: privacy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(t.posted);
        setVideoTitle("");
        setVideoUrl("");
      } else {
        setMessage(`${t.postFailed}: ${data.error}`);
      }
    } catch {
      setMessage(t.postFailed);
    } finally {
      setPosting(false);
    }
  }

  function handleConnect() {
    const clientKey = "sbawg8ocnk6tzdia9g";
    const redirectUri = `${window.location.origin}/api/tiktok/callback`;
    const scope = "user.info.basic,video.publish,video.upload";
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=xpilot`;
    window.location.href = status?.authUrl || authUrl;
  }

  if (!user) return null;

  return (
    <DashboardShell user={user}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-gray-400 mt-1">{t.subtitle}</p>
        </div>

        {/* Sandbox Notice */}
        <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-4 text-yellow-100 text-sm font-medium">
          {t.sandboxNotice}
        </div>

        {/* Connection Status */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">{t.accountInfo}</h2>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : status?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-400 font-medium">{t.connected}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">{t.openId}:</span>
                  <span className="ml-2 text-gray-200 font-mono text-xs">{status.openId}</span>
                </div>
                <div>
                  <span className="text-gray-400">{t.scope}:</span>
                  <span className="ml-2 text-gray-200">{status.scope}</span>
                </div>
                <div>
                  <span className="text-gray-400">{t.expiresAt}:</span>
                  <span className="ml-2 text-gray-200">
                    {status.expiresAt
                      ? new Date(status.expiresAt).toLocaleString()
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                <span className="text-red-400 font-medium">{t.notConnected}</span>
              </div>
              <p className="text-gray-400 text-sm">{t.noAccount}</p>
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-[#fe2c55] hover:bg-[#e0274d] text-white rounded-lg font-medium transition-colors"
              >
                {t.authorize}
              </button>
            </div>
          )}
        </div>

        {/* Post Video Form */}
        {status?.connected && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">{t.postVideo}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t.videoTitle}</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="xPilot - AI Social Media Copilot #xPilot #AIMarketing"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#fe2c55]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t.videoUrl}</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#fe2c55]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t.privacy}</label>
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#fe2c55]"
                >
                  <option value="PUBLIC_TO_EVERYONE">{t.privacyPublic}</option>
                  <option value="SELF_ONLY">{t.privacySelf}</option>
                  <option value="MUTUAL_FOLLOW_FRIENDS">{t.privacyFriends}</option>
                </select>
              </div>
              {message && (
                <div
                  className={`text-sm p-3 rounded-lg ${
                    message.includes(t.posted)
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {message}
                </div>
              )}
              <button
                onClick={handlePost}
                disabled={posting || !videoTitle || !videoUrl}
                className="px-4 py-2 bg-[#fe2c55] hover:bg-[#e0274d] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? t.posting : t.postVideo}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
