"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
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
  tasksCompleted: number;
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  en: { active: "active", paused: "paused", completed: "completed", unknown: "unknown" },
  zh: { active: "\u8fd0\u884c\u4e2d", paused: "\u5df2\u6682\u505c", completed: "\u5df2\u5b8c\u6210", unknown: "\u672a\u77e5" },
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: {
    engineering: "Engineering", lead_generation: "Lead Generation", email_marketing: "Email Marketing",
    seo: "SEO", social_media: "Social Media", monitoring: "Monitoring", project_mgmt: "Project Mgmt",
    product: "Product", marketing: "Marketing", sales: "Sales", advertising: "Advertising",
    research: "Research", other: "Other",
  },
  zh: {
    engineering: "\u5de5\u7a0b", lead_generation: "\u6f5c\u5ba2\u5f00\u53d1", email_marketing: "\u90ae\u4ef6\u8425\u9500",
    seo: "SEO \u4f18\u5316", social_media: "\u793e\u4ea4\u5a92\u4f53", monitoring: "\u76d1\u63a7", project_mgmt: "\u9879\u76ee\u7ba1\u7406",
    product: "\u4ea7\u54c1", marketing: "\u8425\u9500", sales: "\u9500\u552e", advertising: "\u5e7f\u544a",
    research: "\u7814\u7a76", other: "\u5176\u4ed6",
  },
};

const METRIC_LABELS: Record<string, Record<string, string>> = {
  en: {
    leads: "leads", emails_sent: "emails sent", contacts_found: "contacts found", tweets: "tweets",
    posts_published: "posts published", articles: "articles", prs_created: "PRs created",
    subscribers: "subscribers", crm_leads: "CRM leads", uptime_pct: "uptime %",
    tasks_completed: "tasks completed", issues: "issues", duration_sec: "duration (s)", errors: "errors",
    sales: "sales",
  },
  zh: {
    leads: "\u6f5c\u5ba2", emails_sent: "\u5df2\u53d1\u90ae\u4ef6", contacts_found: "\u5df2\u627e\u5230\u8054\u7cfb\u4eba", tweets: "\u63a8\u6587",
    posts_published: "\u5df2\u53d1\u5e03\u6587\u7ae0", articles: "\u6587\u7ae0", prs_created: "\u5df2\u521b\u5efa PR",
    subscribers: "\u8ba2\u9605\u8005", crm_leads: "CRM \u6f5c\u5ba2", uptime_pct: "\u8fd0\u884c\u65f6\u95f4 %",
    tasks_completed: "\u5df2\u5b8c\u6210\u4efb\u52a1", issues: "\u95ee\u9898", duration_sec: "\u8017\u65f6\uff08\u79d2\uff09", errors: "\u9519\u8bef",
    sales: "\u9500\u552e",
  },
};

function statusBadge(status: string | null, locale: string) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    paused: "bg-yellow-100 text-yellow-700",
    completed: "bg-blue-100 text-blue-700",
  };
  const s = status || "unknown";
  const label = STATUS_LABELS[locale]?.[s] || STATUS_LABELS.en[s] || s;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || "bg-gray-100 text-gray-600"}`}>
      {label}
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
  const [brevoStats, setBrevoStats] = useState({ emailsSent: 0, delivered: 0, opened: 0, clicked: 0 });
  const [gaStats, setGaStats] = useState({ totalUsers: 0, sessions: 0, pageViews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/reports?locale=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports || []);
        if (data.brevoStats) setBrevoStats(data.brevoStats);
        if (data.gaStats) setGaStats(data.gaStats);
      })
      .finally(() => setLoading(false));
  }, [user, locale]);

  const agentMetrics = reports.reduce(
    (acc, r) => {
      const m = r.metrics || {};
      acc.leadsGenerated += Number(m.leads || m.leads_generated || m.prospects || m.crm_leads || m.subscribers || 0);
      acc.contentPublished += Number(m.articles || m.posts_published || m.content || m.prs_created || 0);
      acc.tasksCompleted += Number(m.tasks_completed || m.issues || 0);
      return acc;
    },
    { leadsGenerated: 0, contentPublished: 0, tasksCompleted: 0 }
  );
  const metrics: MetricsSummary = {
    totalTraffic: gaStats.pageViews,
    emailsSent: brevoStats.emailsSent,
    emailsFound: brevoStats.opened,
    leadsGenerated: agentMetrics.leadsGenerated,
    contentPublished: agentMetrics.contentPublished,
    tasksCompleted: agentMetrics.tasksCompleted,
  };

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
    { label: tr.emailsOpened, value: metrics.emailsFound, icon: "\u{1F4EC}", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { label: tr.leadsGenerated, value: metrics.leadsGenerated, icon: "\u{1F465}", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { label: tr.contentPublished, value: metrics.contentPublished, icon: "\u{1F4DD}", color: "bg-teal-50 text-teal-700 border-teal-200" },
    { label: tr.tasksCompleted, value: metrics.tasksCompleted, icon: "\u2705", color: "bg-pink-50 text-pink-700 border-pink-200" },
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
                          <h3 className="font-semibold text-sm">{report.agent.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
                          {statusBadge(report.status, locale)}
                        </div>
                        <span className="text-xs text-gray-400">{report.project}</span>
                      </div>
                      <div className="prose prose-sm prose-gray max-w-none text-gray-600 mb-3 [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_a]:text-blue-600 [&_a]:no-underline hover:[&_a]:underline">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{report.summary}</ReactMarkdown>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {Object.entries(report.metrics).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 px-2.5 py-1.5 rounded text-xs">
                            <span className="text-gray-400">{METRIC_LABELS[locale]?.[key] || METRIC_LABELS.en[key] || key.replace(/_/g, " ")}:</span>{" "}
                            <span className="font-medium text-gray-700">{value}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-400 text-xs">
                        {CATEGORY_LABELS[locale]?.[report.period] || CATEGORY_LABELS.en[report.period] || report.period} &middot; {tr.lastRun} {new Date(report.last_run).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
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
