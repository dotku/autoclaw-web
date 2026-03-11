"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface UserQuota {
  plan: string;
  todayTokens: number;
  todaySpendCents: number;
  dailyLimitCents: number;
  dailyTokenLimit: number;
  remaining: number | null;
  remainingTokens: number | null;
  unlimited: boolean;
}

interface EmbeddingUsage {
  period: string;
  requestCount: number;
  tokenCount: number;
  budget: number;
}

interface StatusData {
  allTime: { prompt_tokens: number; completion_tokens: number; total_tokens: number; request_count: number };
  today: { prompt_tokens: number; completion_tokens: number; total_tokens: number; request_count: number };
  byProvider: { provider: string; total_tokens: number; request_count: number }[];
  last7Days: { date: string; total_tokens: number; request_count: number }[];
  users: number;
  nextResetUtc: string;
  user?: UserQuota;
  embedding?: EmbeddingUsage;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Countdown({ target }: { target: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Resetting..."); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return <span className="font-mono">{timeLeft}</span>;
}

export default function StatusPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const ts = dict.status;

  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxDayTokens = data ? Math.max(...data.last7Days.map((d) => Number(d.total_tokens)), 1) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <img src="/logo.svg" alt="AutoClaw" className="w-9 h-9" />
            <span><span className="text-red-600">Auto</span>Claw</span>
          </Link>
          <LanguageSwitcher locale={locale} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{ts.title}</h1>
          <p className="text-gray-500">{ts.subtitle}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">{dict.common.loading}</div>
        ) : data ? (
          <div className="space-y-6">
            {/* Status indicator */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="text-lg font-semibold text-green-700">{ts.operational}</span>
              </div>
            </div>

            {/* User Quota (if logged in) */}
            {data.user && (
              <div className="bg-white rounded-lg border border-red-200 p-6">
                <h2 className="text-sm font-semibold mb-4">{ts.yourQuota} <span className="text-xs font-normal text-gray-400 capitalize">({data.user.plan} {ts.plan})</span></h2>
                {data.user.unlimited ? (
                  <p className="text-sm text-gray-600">{ts.unlimited}</p>
                ) : (
                  <div className="space-y-3">
                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{formatTokens(data.user.todayTokens)} {ts.used}</span>
                        <span>{formatTokens(data.user.dailyTokenLimit)} {ts.limit}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            data.user.todayTokens / data.user.dailyTokenLimit > 0.9 ? "bg-red-500" :
                            data.user.todayTokens / data.user.dailyTokenLimit > 0.7 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(100, (data.user.todayTokens / data.user.dailyTokenLimit) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold">{formatTokens(data.user.remainingTokens ?? 0)}</p>
                        <p className="text-xs text-gray-500">{ts.remaining}</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">${(data.user.dailyLimitCents / 100).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{ts.dailyBudget}</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold"><Countdown target={data.nextResetUtc} /></p>
                        <p className="text-xs text-gray-500">{ts.nextReset}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{ts.todayTokens}</p>
                <p className="text-2xl font-bold">{formatTokens(Number(data.today.total_tokens))}</p>
                <p className="text-xs text-gray-400 mt-1">{Number(data.today.request_count).toLocaleString()} {ts.requests}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{ts.allTimeTokens}</p>
                <p className="text-2xl font-bold">{formatTokens(Number(data.allTime.total_tokens))}</p>
                <p className="text-xs text-gray-400 mt-1">{Number(data.allTime.request_count).toLocaleString()} {ts.requests}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{ts.registeredUsers}</p>
                <p className="text-2xl font-bold">{data.users}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{ts.nextReset}</p>
                <p className="text-xl font-bold"><Countdown target={data.nextResetUtc} /></p>
                <p className="text-xs text-gray-400 mt-1">UTC {ts.midnight}</p>
              </div>
            </div>

            {/* Last 7 days chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold mb-4">{ts.last7Days}</h2>
              <div className="space-y-2">
                {data.last7Days.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 shrink-0">{new Date(day.date).toLocaleDateString(locale, { month: "short", day: "numeric" })}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(Number(day.total_tokens) / maxDayTokens) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 font-mono w-16 text-right">{formatTokens(Number(day.total_tokens))}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By provider */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold mb-4">{ts.byProvider}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="py-2 font-medium">{ts.provider}</th>
                      <th className="py-2 font-medium text-right">{ts.totalTokens}</th>
                      <th className="py-2 font-medium text-right">{ts.requests}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProvider.map((p) => (
                      <tr key={p.provider} className="border-b border-gray-50">
                        <td className="py-2 font-medium capitalize">{p.provider}</td>
                        <td className="py-2 text-right font-mono">{formatTokens(Number(p.total_tokens))}</td>
                        <td className="py-2 text-right font-mono">{Number(p.request_count).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Embedding Usage */}
            {data.embedding && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-sm font-semibold mb-4">{ts.embeddingUsage || "Embedding Usage"} <span className="text-xs font-normal text-gray-400">({data.embedding.period})</span></h2>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{formatTokens(data.embedding.requestCount)} {ts.requests}</span>
                      <span>{formatTokens(data.embedding.budget)} {ts.limit || "limit"}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          data.embedding.requestCount / data.embedding.budget > 0.9 ? "bg-red-500" :
                          data.embedding.requestCount / data.embedding.budget > 0.7 ? "bg-yellow-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(100, (data.embedding.requestCount / data.embedding.budget) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold">{formatTokens(data.embedding.requestCount)}</p>
                      <p className="text-xs text-gray-500">{ts.requests}</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{formatTokens(data.embedding.tokenCount)}</p>
                      <p className="text-xs text-gray-500">{ts.embeddingTokens || "Tokens Embedded"}</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{formatTokens(Math.max(0, data.embedding.budget - data.embedding.requestCount))}</p>
                      <p className="text-xs text-gray-500">{ts.remaining}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">{ts.unavailable}</div>
        )}
      </main>
    </div>
  );
}
