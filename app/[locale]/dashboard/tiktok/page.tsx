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

interface GeneratedVideo {
  taskId: string;
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  prompt: string;
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

  // Video generation state
  const [genPrompt, setGenPrompt] = useState("");
  const [genDuration, setGenDuration] = useState("4");
  const [generating, setGenerating] = useState(false);
  const [genVideos, setGenVideos] = useState<GeneratedVideo[]>([]);
  const [genMessage, setGenMessage] = useState("");
  const [xpilotKey, setXpilotKey] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchXpilotKey();
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

  async function fetchXpilotKey() {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      const key = data.keys?.find((k: { service: string }) => k.service === "xpilot");
      setXpilotKey(key ? "configured" : null);
    } catch {
      setXpilotKey(null);
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

  async function handleGenerate() {
    if (!genPrompt) return;
    setGenerating(true);
    setGenMessage("");
    try {
      const res = await fetch("/api/tiktok/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: genPrompt,
          duration: parseInt(genDuration),
        }),
      });
      const data = await res.json();
      if (data.taskId) {
        const newVideo: GeneratedVideo = {
          taskId: data.taskId,
          status: "processing",
          prompt: genPrompt,
        };
        setGenVideos((prev) => [newVideo, ...prev]);
        setGenMessage(t.genSubmitted);
        setGenPrompt("");
        // Start polling
        pollVideoStatus(data.taskId, data.provider);
      } else {
        setGenMessage(`${t.genFailed}: ${data.error}`);
      }
    } catch {
      setGenMessage(t.genFailed);
    } finally {
      setGenerating(false);
    }
  }

  async function pollVideoStatus(taskId: string, provider?: string) {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const providerParam = provider ? `?provider=${provider}` : "";
        const res = await fetch(`/api/tiktok/generate?taskId=${taskId}${providerParam}`);
        const data = await res.json();
        if (data.status === "completed" && data.videoUrl) {
          setGenVideos((prev) =>
            prev.map((v) =>
              v.taskId === taskId ? { ...v, status: "completed", videoUrl: data.videoUrl } : v
            )
          );
          return;
        } else if (data.status === "failed") {
          setGenVideos((prev) =>
            prev.map((v) => (v.taskId === taskId ? { ...v, status: "failed" } : v))
          );
          return;
        }
      } catch {
        // continue polling
      }
    }
    // Timeout
    setGenVideos((prev) =>
      prev.map((v) => (v.taskId === taskId ? { ...v, status: "failed" } : v))
    );
  }

  function handleConnect() {
    const clientKey = "sbawg8ocnk6tzdia9g";
    const redirectUri = `${window.location.origin}/api/tiktok/callback`;
    const scope = "user.info.basic,video.publish,video.upload";
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=xpilot`;
    window.location.href = status?.authUrl || authUrl;
  }

  function useGeneratedVideo(video: GeneratedVideo) {
    if (video.videoUrl) {
      setVideoUrl(video.videoUrl);
      setVideoTitle(video.prompt.slice(0, 150) + " #xPilot #AIMarketing");
    }
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
        <div className="bg-orange-600 border border-orange-500 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-white mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-white text-sm font-semibold">{t.sandboxNotice}</span>
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

        {/* AI Video Generation */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">{t.genTitle}</h2>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">xPilot AI</span>
          </div>

          {!xpilotKey ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm mb-3">{t.genNeedKey}</p>
              <a
                href={`/${locale}/dashboard/settings`}
                className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t.genConfigKey}
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t.genPromptLabel}</label>
                <textarea
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  placeholder={t.genPromptPlaceholder}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t.genDuration}</label>
                  <select
                    value={genDuration}
                    onChange={(e) => setGenDuration(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="4">4s</option>
                    <option value="8">8s</option>
                    <option value="12">12s</option>
                  </select>
                </div>
                <div className="flex-1" />
                <button
                  onClick={handleGenerate}
                  disabled={generating || !genPrompt}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
                >
                  {generating ? t.genGenerating : t.genGenerate}
                </button>
              </div>
              {genMessage && (
                <div className={`text-sm p-3 rounded-lg ${genMessage.includes(t.genFailed) ? "bg-red-500/10 text-red-400" : "bg-purple-500/10 text-purple-300"}`}>
                  {genMessage}
                </div>
              )}

              {/* Generated Videos */}
              {genVideos.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-medium text-gray-300">{t.genResults}</h3>
                  {genVideos.map((video) => (
                    <div key={video.taskId} className="border border-white/10 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-gray-300 line-clamp-2">{video.prompt}</p>
                      <div className="flex items-center gap-3">
                        {video.status === "processing" && (
                          <span className="flex items-center gap-2 text-xs text-yellow-400">
                            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                            {t.genProcessing}
                          </span>
                        )}
                        {video.status === "completed" && (
                          <>
                            <span className="flex items-center gap-2 text-xs text-green-400">
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                              {t.genCompleted}
                            </span>
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-purple-400 hover:text-purple-300 underline"
                            >
                              {t.genPreview}
                            </a>
                            {status?.connected && (
                              <button
                                onClick={() => useGeneratedVideo(video)}
                                className="text-xs bg-[#fe2c55] hover:bg-[#e0274d] text-white px-3 py-1 rounded-lg transition-colors"
                              >
                                {t.genUseForPost}
                              </button>
                            )}
                          </>
                        )}
                        {video.status === "failed" && (
                          <span className="flex items-center gap-2 text-xs text-red-400">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                            {t.genFailed}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
