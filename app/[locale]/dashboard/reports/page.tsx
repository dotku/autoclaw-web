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

interface DailyTraffic {
  date: string;
  users: number;
  sessions: number;
  pageViews: number;
}

interface ProjectTraffic {
  project: string;
  data: DailyTraffic[];
}

interface MetricsSummary {
  totalTraffic: number;
  emailsSent: number;
  emailsFound: number;
  leadsGenerated: number;
  contentPublished: number;
  tasksCompleted: number;
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function CombinedTrafficChart({ projects, locale }: { projects: ProjectTraffic[]; locale: string }) {
  if (projects.length === 0) return null;

  // Build a unified date axis from all projects
  const allDates = new Set<string>();
  for (const p of projects) for (const d of p.data) allDates.add(d.date);
  const dates = Array.from(allDates).sort();
  if (dates.length === 0) return null;

  // Build lookup per project: date → pageViews
  const projectLines = projects.map((p, idx) => {
    const lookup: Record<string, number> = {};
    for (const d of p.data) lookup[d.date] = d.pageViews;
    return { name: p.project, color: CHART_COLORS[idx % CHART_COLORS.length], lookup };
  });

  const maxVal = Math.max(...projects.flatMap((p) => p.data.map((d) => d.pageViews)), 1);
  const W = 700;
  const H = 220;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const xFor = (i: number) => padL + (i / Math.max(dates.length - 1, 1)) * chartW;
  const yFor = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const step = Math.max(1, Math.floor(dates.length / 6));
  const xLabelIndices = dates.map((_, i) => i).filter((i) => i % step === 0 || i === dates.length - 1);

  const pvLabel = locale === "zh" ? "\u9875\u9762\u6d4f\u89c8" : "Page Views";
  const chartTitle = locale === "zh" ? "\u6bcf\u65e5\u6d41\u91cf\u8d8b\u52bf\uff08\u8fd130\u5929\uff09" : "Daily Traffic Trend (Last 30 Days)";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-sm">{chartTitle}</h3>
        <div className="flex flex-wrap gap-3">
          {projectLines.map((pl) => (
            <div key={pl.name} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-[3px] rounded" style={{ backgroundColor: pl.color }} />
              <span className="text-xs text-gray-500">{pl.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px]" style={{ maxHeight: 240 }}>
          <defs>
            {projectLines.map((pl) => (
              <linearGradient key={pl.name} id={`grad_${pl.name.replace(/\s/g, "_")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={pl.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={pl.color} stopOpacity={0.03} />
              </linearGradient>
            ))}
          </defs>
          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{tick}</text>
              </g>
            );
          })}
          {/* Per-project area + line + dots */}
          {projectLines.map((pl) => {
            const pts = dates.map((d, i) => ({ x: xFor(i), y: yFor(pl.lookup[d] || 0), val: pl.lookup[d] || 0, date: d }));
            const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
            const areaPath = `${linePath} L${pts[pts.length - 1].x},${yFor(0)} L${pts[0].x},${yFor(0)} Z`;
            const gradId = `grad_${pl.name.replace(/\s/g, "_")}`;
            return (
              <g key={pl.name}>
                <path d={areaPath} fill={`url(#${gradId})`} />
                <path d={linePath} fill="none" stroke={pl.color} strokeWidth={2} />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={2} fill={pl.color} stroke="white" strokeWidth={0.8}>
                    <title>{`${pl.name} · ${p.date}: ${p.val} ${pvLabel}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
          {/* X labels */}
          {xLabelIndices.map((i) => (
            <text key={dates[i]} x={xFor(i)} y={H - 5} textAnchor="middle" fontSize={9} fill="#9ca3af">{dates[i].slice(5)}</text>
          ))}
        </svg>
      </div>
    </div>
  );
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
    completed: "bg-red-100 text-red-700",
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
  const [gaProjects, setGaProjects] = useState<ProjectTraffic[]>([]);
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
        if (data.gaProjects) setGaProjects(data.gaProjects);
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
          <a href={`/auth/login?returnTo=/${locale}/dashboard/reports`} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">{tc.logIn}</a>
        </div>
      </div>
    );
  }

  const metricCards = [
    { label: tr.totalTraffic, value: metrics.totalTraffic, icon: "\u{1F4CA}", color: "bg-red-50 text-red-700 border-red-200" },
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
          <Link href={`/${locale}`} className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <img src="/logo.svg" alt="AutoClaw" className="w-9 h-9" />
            <span><span className="text-red-600">Auto</span>Claw</span>
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

            {gaProjects.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4">{locale === "zh" ? "\u7f51\u7ad9\u6d41\u91cf" : "Website Traffic"}</h2>
                <CombinedTrafficChart projects={gaProjects} locale={locale} />
              </section>
            )}

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
                      <div className="prose prose-sm prose-gray max-w-none text-gray-600 mb-3 [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_a]:text-red-600 [&_a]:no-underline hover:[&_a]:underline">
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
