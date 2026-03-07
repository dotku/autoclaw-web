"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface AgentReport {
  id: string;
  agent: string;
  period: string;
  summary: string;
  metrics: Record<string, string | number>;
  status: string;
  project: string;
  last_run: string;
}

interface MetricsSummary {
  totalTraffic: number;
  emailsSent: number;
  emailsFound: number;
  leadsGenerated: number;
  contentPublished: number;
  socialPosts: number;
}

function statusBadge(status: string | null) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    paused: "bg-yellow-100 text-yellow-700",
    completed: "bg-blue-100 text-blue-700",
  };
  const s = status || "unknown";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || "bg-gray-100 text-gray-600"}`}>
      {s}
    </span>
  );
}

export default function ReportsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || "en";
  const dict = getDictionary(locale);
  const tr = dict.reportsPage;
  const tc = dict.common;

  const { user, isLoading: userLoading } = useUser();
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => setReports(data.reports || []))
      .finally(() => setLoading(false));
  }, [user]);

  const metrics: MetricsSummary = reports.reduce(
    (acc, r) => {
      const m = r.metrics || {};
      acc.totalTraffic += Number(m.traffic || m.visits || m.page_views || 0);
      acc.emailsSent += Number(m.emails_sent || m.email_sent || 0);
      acc.emailsFound += Number(m.emails_found || m.contacts_found || 0);
      acc.leadsGenerated += Number(m.leads || m.leads_generated || m.prospects || 0);
      acc.contentPublished += Number(m.articles || m.posts_published || m.content || 0);
      acc.socialPosts += Number(m.social_posts || m.tweets || m.posts || 0);
      return acc;
    },
    { totalTraffic: 0, emailsSent: 0, emailsFound: 0, leadsGenerated: 0, contentPublished: 0, socialPosts: 0 }
  );

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">{tc.loading}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{tr.title}</h1>
          <a href={`/auth/login?returnTo=/${locale}/dashboard/reports`} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
        </div>
      </div>
    );
  }

  const metricCards = [
    { label: tr.totalTraffic, value: metrics.totalTraffic, icon: "\u{1F4CA}", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: tr.emailsSent, value: metrics.emailsSent, icon: "\u{1F4E7}", color: "bg-green-50 text-green-700 border-green-200" },
    { label: tr.emailsFound, value: metrics.emailsFound, icon: "\u{1F50D}", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { label: tr.leadsGenerated, value: metrics.leadsGenerated, icon: "\u{1F465}", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { label: tr.contentPublished, value: metrics.contentPublished, icon: "\u{1F4DD}", color: "bg-teal-50 text-teal-700 border-teal-200" },
    { label: tr.socialPosts, value: metrics.socialPosts, icon: "\u{1F4F1}", color: "bg-pink-50 text-pink-700 border-pink-200" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-xl font-bold tracking-tight">
            <span className="text-blue-600">Auto</span>Claw
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher locale={locale} />
            <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            <a href="/auth/logout" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{tc.logOut}</a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">{tr.title}</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            <Link href={`/${locale}/dashboard`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.chat}</Link>
            <Link href={`/${locale}/dashboard/agents`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.agents}</Link>
            <span className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium bg-white text-gray-900 shadow-sm whitespace-nowrap">{tc.reports}</span>
            <Link href={`/${locale}/dashboard/billing`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.billing}</Link>
            <Link href={`/${locale}/dashboard/settings`} className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">{tc.settings}</Link>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">{tc.loading}</p>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">{tr.overview}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {metricCards.map((card) => (
                  <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
                    <div className="text-2xl mb-1">{card.icon}</div>
                    <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
                    <div className="text-xs font-medium mt-1 opacity-80">{card.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">{tr.agentReports}</h2>
              {reports.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <p className="text-gray-500 mb-2">{tr.noReports}</p>
                  <p className="text-gray-400 text-sm">{tr.noReportsDesc}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{report.agent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
                          {statusBadge(report.status)}
                        </div>
                        <span className="text-xs text-gray-400">{report.project}</span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{report.summary}</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {Object.entries(report.metrics).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 px-2.5 py-1.5 rounded text-xs">
                            <span className="text-gray-400">{key.replace(/_/g, " ")}:</span>{" "}
                            <span className="font-medium text-gray-700">{value}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-400 text-xs">
                        {report.period} &middot; {tr.lastRun} {new Date(report.last_run).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
