import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { execSync } from "child_process";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export const dynamic = "force-dynamic";

interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  state: {
    lastStatus?: string;
    lastRunAtMs?: number;
    lastDurationMs?: number;
    consecutiveErrors?: number;
  };
}

function detectProject(name: string): string {
  if (name.includes("gpulaw")) return "GPULaw";
  if (name.includes("medchat")) return "MedChat";
  if (name.includes("sienovo")) return "Sienovo";
  if (name.includes("medtravel") || name.includes("dental") || name.includes("implant")) return "MedTravel";
  if (name.includes("iris") || name.includes("limo")) return "Iris Limo";
  if (name.includes("usproglove") || name.includes("proglove") || name.includes("glove") || name.includes("nitrile") || name.includes("ppe")) return "US ProGlove";
  if (name.includes("dkwholesale") || name.includes("dk-wholesale")) return "DK Wholesale";
  if (name.includes("xpilot") || name.includes("x-post")) return "xPilot";
  if (name.includes("unincore")) return "Unincore";
  if (name.includes("ouxi")) return "OUXI";
  if (name.includes("jytech")) return "JY Tech";
  // Generic jobs — don't assign to a specific project
  return "General";
}

function detectCategory(name: string): string {
  if (name.includes("lead") || name.includes("prospect") || name.includes("scraper")) return "lead_generation";
  if (name.includes("email") || name.includes("brevo") || name.includes("cold-email")) return "email_marketing";
  if (name.includes("seo") || name.includes("blog") || name.includes("backlink") || name.includes("content-optimizer")) return "seo";
  if (name.includes("tweet") || name.includes("x-") || name.includes("linkedin") || name.includes("marketing-tweet") || name.includes("community")) return "social_media";
  if (name.includes("health") || name.includes("monitor") || name.includes("sre") || name.includes("site-report")) return "monitoring";
  if (name.includes("standup") || name.includes("sprint") || name.includes("project-review")) return "project_mgmt";
  if (name.includes("product") || name.includes("analytics")) return "product";
  if (name.includes("sales") || name.includes("followup") || name.includes("hubspot")) return "sales";
  if (name.includes("dev") || name.includes("github") || name.includes("quality") || name.includes("security") || name.includes("dep-")) return "engineering";
  if (name.includes("ads") || name.includes("google-ads")) return "advertising";
  if (name.includes("model-scout") || name.includes("integration")) return "research";
  return "other";
}

function categorizeAgent(name: string): { category: string; project: string } {
  return { category: detectCategory(name), project: detectProject(name) };
}

function extractMetrics(text: string): Record<string, number> {
  const metrics: Record<string, number> = {};
  const patterns: [RegExp, string][] = [
    [/(\d+)\s*(?:new\s+)?leads?\s+(?:found|generated|imported|contacted|scraped)/i, "leads"],
    [/(\d+)\s*emails?\s+sent/i, "emails_sent"],
    [/(\d+)\s*(?:contacts?|emails?)\s+found/i, "contacts_found"],
    [/(\d+)\s*tweets?\s+(?:posted|sent|published)/i, "tweets"],
    [/(\d+)\s*(?:blog\s+)?posts?\s+(?:published|created)/i, "posts_published"],
    [/(\d+)\s*(?:articles?)\s+(?:published|written)/i, "articles"],
    [/(\d+)\s*PRs?\s+created/i, "prs_created"],
    [/[Rr]ecipients.*?(\d+)\s*subscribers?/i, "emails_sent"],
    [/subscribers?:\s*\*?\*?(\d+)/i, "subscribers"],
    [/CRM\s+leads?:\s*\*?\*?(\d+)/i, "crm_leads"],
    [/(\d+)%\s*(?:uptime|health)/i, "uptime_pct"],
    [/(\d+)\s*tasks?\s+completed/i, "tasks_completed"],
    [/(\d+)\s*(?:issues?|bugs?)\s+(?:found|opened|created)/i, "issues"],
    [/Campaign\s+ID.*?(\d+)/i, "campaigns"],
  ];
  for (const [pattern, key] of patterns) {
    const match = text.match(pattern);
    if (match) metrics[key] = parseFloat(match[1]);
  }
  return metrics;
}

function readOpenClawData(): { jobs: CronJob[]; summaries: Record<string, string> } {
  try {
    const jobsRaw = execSync(
      "docker exec openclaw-gateway cat /home/node/.openclaw/cron/jobs.json",
      { timeout: 5000, encoding: "utf-8" }
    );
    const jobsData = JSON.parse(jobsRaw);
    const jobs: CronJob[] = jobsData.jobs || [];

    // Read latest session summaries via pre-deployed extraction script
    let summaries: Record<string, string> = {};
    try {
      const summariesRaw = execSync(
        "docker exec openclaw-gateway node /tmp/extract-sessions.js",
        { timeout: 15000, encoding: "utf-8" }
      );
      summaries = JSON.parse(summariesRaw.trim());
    } catch {
      // Script not deployed yet or extraction failed - continue with jobs only
    }

    return { jobs, summaries };
  } catch {
    return { jobs: [], summaries: {} };
  }
}

const STATUS_FALLBACK: Record<string, Record<string, string>> = {
  en: { ok: "OK", error: "Error", unknown: "Unknown" },
  zh: { ok: "\u6b63\u5e38", error: "\u9519\u8bef", unknown: "\u672a\u77e5" },
};

function fallbackSummary(job: CronJob, locale: string): string {
  const durationSec = Math.round((job.state.lastDurationMs || 0) / 1000);
  const statusKey = job.state.lastStatus || "unknown";
  const statusLabel = STATUS_FALLBACK[locale]?.[statusKey] || STATUS_FALLBACK.en[statusKey] || statusKey;
  if (locale === "zh") {
    return `\u72b6\u6001\uff1a${statusLabel}\u3002\u8017\u65f6\uff1a${durationSec}\u79d2\u3002`;
  }
  return `Status: ${statusLabel}. Duration: ${durationSec}s.`;
}

// Map cron job project labels to DB project names (for matching)
const PROJECT_ALIASES: Record<string, string[]> = {
  "Iris Limo": ["iris", "limo", "iris-limo"],
  "GPULaw": ["gpulaw"],
  "MedTravel": ["medtravel"],
  "MedChat": ["medchat"],
  "Sienovo": ["sienovo"],
};

function matchesUserProject(cronProject: string, userProjectNames: string[]): boolean {
  // Direct match
  if (userProjectNames.includes(cronProject)) return true;
  // Check aliases
  for (const userProject of userProjectNames) {
    const aliases = PROJECT_ALIASES[userProject];
    if (aliases && aliases.some((a) => cronProject.toLowerCase().includes(a))) return true;
    // Fuzzy: check if cron project name is contained in user project name or vice versa
    if (cronProject.toLowerCase().includes(userProject.toLowerCase())) return true;
    if (userProject.toLowerCase().includes(cronProject.toLowerCase())) return true;
  }
  return false;
}

export async function GET(request: Request) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "en";
  const email = session.user.email as string;

  // Look up user and their projects + role
  const sql = getDb();
  let users = await sql`SELECT id, role, plan FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    users = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${email}, ${(session.user.name as string) || ""}, ${session.user.sub as string}) RETURNING id, role, plan`;
  }
  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";
  const isEnterprise = users[0].plan === "enterprise";

  // Extract email domain for domain-based project sharing (enterprise feature)
  const emailDomain = email.split("@")[1] || "";
  const userProjects = isAdmin
    ? await sql`SELECT id, name, ga_property_id FROM projects`
    : await sql`SELECT DISTINCT ON (name) id, name, ga_property_id FROM projects WHERE user_id = ${userId} OR (domain IS NOT NULL AND domain != '' AND domain = ${emailDomain}) ORDER BY name`;
  const userProjectNames = userProjects.map((p) => p.name as string);
  // Use first project name as default label for "General" jobs
  const defaultProjectName = userProjectNames[0] || "General";

  const { jobs, summaries } = readOpenClawData();

  // Build report for each job (only jobs that have run)
  const allReports = jobs
    .filter((j) => j.state?.lastRunAtMs)
    .sort((a, b) => (b.state.lastRunAtMs || 0) - (a.state.lastRunAtMs || 0))
    .map((job) => {
      const summary = summaries[job.name] || "";
      const metrics = extractMetrics(summary);
      const { category, project } = categorizeAgent(job.name);
      const durationSec = Math.round((job.state.lastDurationMs || 0) / 1000);

      return {
        id: job.id,
        agent: job.name,
        period: category,
        summary: summary || fallbackSummary(job, locale),
        metrics: {
          ...metrics,
          duration_sec: durationSec,
          ...(job.state.consecutiveErrors ? { errors: job.state.consecutiveErrors } : {}),
        },
        status: job.state.lastStatus === "ok" ? "active" : job.state.lastStatus === "error" ? "paused" : "completed",
        project,
        last_run: job.state.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : "",
      };
    });

  // Admin sees all reports; regular users see only their project reports (no "General" fallback)
  const reports = isAdmin
    ? allReports
    : allReports
        .filter((r) => r.project !== "General" && matchesUserProject(r.project, userProjectNames));

  // Build server agents list from ALL configured jobs (including ones that haven't run yet)
  const allServerAgents = jobs
    .sort((a, b) => (b.state.lastRunAtMs || 0) - (a.state.lastRunAtMs || 0))
    .map((job) => {
      const summary = summaries[job.name] || "";
      const metrics = extractMetrics(summary);
      const { category, project } = categorizeAgent(job.name);
      const durationSec = Math.round((job.state.lastDurationMs || 0) / 1000);
      const hasRun = !!job.state?.lastRunAtMs;

      return {
        id: job.id,
        agent: job.name,
        description: job.description || "",
        period: category,
        summary: hasRun ? (summary || fallbackSummary(job, locale)) : "",
        metrics: hasRun ? {
          ...metrics,
          duration_sec: durationSec,
          ...(job.state.consecutiveErrors ? { errors: job.state.consecutiveErrors } : {}),
        } : {},
        status: !hasRun ? "pending" : job.state.lastStatus === "ok" ? "active" : job.state.lastStatus === "error" ? "paused" : "completed",
        enabled: job.enabled !== false,
        project,
        last_run: hasRun ? new Date(job.state.lastRunAtMs!).toISOString() : "",
      };
    });

  const serverAgents = isAdmin
    ? allServerAgents
    : allServerAgents
        .filter((a) => a.project !== "General" && matchesUserProject(a.project, userProjectNames));

  // Fetch Brevo email statistics
  let brevoStats = { emailsSent: 0, delivered: 0, opened: 0, clicked: 0 };
  interface BrevoCampaign {
    id: number;
    name: string;
    status: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    project: string;
    sentDate?: string;
  }
  let brevoCampaigns: BrevoCampaign[] = [];
  if (process.env.BREVO_API_KEY) {
    try {
      const [aggRes, campRes] = await Promise.all([
        fetch("https://api.brevo.com/v3/smtp/statistics/aggregatedReport", {
          headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
        }),
        fetch("https://api.brevo.com/v3/emailCampaigns?limit=50&sort=desc", {
          headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
        }),
      ]);
      if (aggRes.ok) {
        const data = await aggRes.json();
        brevoStats = {
          emailsSent: data.requests || 0,
          delivered: data.delivered || 0,
          opened: data.uniqueOpens || 0,
          clicked: data.uniqueClicks || 0,
        };
      }
      if (campRes.ok) {
        const campData = await campRes.json();
        const allCampaigns: BrevoCampaign[] = (campData.campaigns || []).map((c: Record<string, unknown>) => {
          const statsObj = c.statistics as Record<string, unknown> | undefined;
          const globalStats = (statsObj?.globalStats as Record<string, number>) || {};
          // Brevo sometimes puts actual data in campaignStats (per-list) instead of globalStats
          const campStats = (statsObj?.campaignStats as Record<string, number>[]) || [];
          const aggregated = campStats.reduce(
            (acc, cs) => ({
              sent: acc.sent + (cs.sent || 0),
              delivered: acc.delivered + (cs.delivered || 0),
              uniqueViews: acc.uniqueViews + (cs.uniqueViews || 0),
              uniqueClicks: acc.uniqueClicks + (cs.uniqueClicks || 0),
            }),
            { sent: 0, delivered: 0, uniqueViews: 0, uniqueClicks: 0 }
          );
          // Use campaignStats if globalStats are zero but campaignStats have data
          const sent = globalStats.sent || aggregated.sent;
          const delivered = globalStats.delivered || aggregated.delivered;
          const opened = globalStats.uniqueOpens || globalStats.uniqueViews || aggregated.uniqueViews;
          const clicked = globalStats.uniqueClicks || aggregated.uniqueClicks;
          const campName = (c.name as string) || (c.subject as string) || "";
          return {
            id: c.id as number,
            name: campName,
            status: (c.status as string) || "unknown",
            sent,
            delivered,
            opened,
            clicked,
            project: detectProject(campName.toLowerCase().replace(/\s+/g, "-")),
            sentDate: (c.sentDate as string) || (c.scheduledAt as string) || "",
          };
        });
        // Filter campaigns by user's projects (admin sees all, non-admin only sees their projects — no "General" fallback)
        brevoCampaigns = isAdmin
          ? allCampaigns
          : allCampaigns.filter((c) =>
              c.project !== "General" && matchesUserProject(c.project, userProjectNames)
            );
        // For non-admin users, recompute brevoStats from their filtered campaigns only
        if (!isAdmin && brevoCampaigns.length > 0) {
          brevoStats = brevoCampaigns.reduce(
            (acc, c) => ({
              emailsSent: acc.emailsSent + c.sent,
              delivered: acc.delivered + c.delivered,
              opened: acc.opened + c.opened,
              clicked: acc.clicked + c.clicked,
            }),
            { emailsSent: 0, delivered: 0, opened: 0, clicked: 0 }
          );
        }
      }
    } catch {
      // Brevo API unavailable — continue with defaults
    }
  }

  // Fetch GA4 traffic statistics (last 30 days)
  let gaStats = { totalUsers: 0, sessions: 0, pageViews: 0 };
  // Build property → project name mapping (deduplicate by property ID)
  const propertyProjectMap: Record<string, string> = {};
  for (const p of userProjects) {
    const pid = p.ga_property_id as string;
    if (pid && !propertyProjectMap[pid]) {
      propertyProjectMap[pid] = p.name as string;
    }
  }
  const gaPropertyIds = Object.keys(propertyProjectMap);
  // Per-project daily data: { projectName: string, data: DailyPoint[] }[]
  const gaProjects: { project: string; data: { date: string; users: number; sessions: number; pageViews: number }[] }[] = [];

  if (process.env.GA_SERVICE_ACCOUNT_KEY && gaPropertyIds.length > 0) {
    try {
      const credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_KEY);
      const analyticsClient = new BetaAnalyticsDataClient({ credentials });

      for (const propertyId of gaPropertyIds) {
        const projectName = propertyProjectMap[propertyId];
        try {
          // Totals
          const [response] = await analyticsClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            metrics: [
              { name: "totalUsers" },
              { name: "sessions" },
              { name: "screenPageViews" },
            ],
          });
          if (response.rows?.[0]?.metricValues) {
            const vals = response.rows[0].metricValues;
            gaStats.totalUsers += Number(vals[0]?.value || 0);
            gaStats.sessions += Number(vals[1]?.value || 0);
            gaStats.pageViews += Number(vals[2]?.value || 0);
          }
          // Daily breakdown per project
          const [dailyRes] = await analyticsClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "date" }],
            metrics: [
              { name: "totalUsers" },
              { name: "sessions" },
              { name: "screenPageViews" },
            ],
            orderBys: [{ dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" } }],
          });
          const dailyData: { date: string; users: number; sessions: number; pageViews: number }[] = [];
          for (const row of dailyRes.rows || []) {
            const dateStr = row.dimensionValues?.[0]?.value || "";
            const formatted = dateStr.length === 8
              ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
              : dateStr;
            dailyData.push({
              date: formatted,
              users: Number(row.metricValues?.[0]?.value || 0),
              sessions: Number(row.metricValues?.[1]?.value || 0),
              pageViews: Number(row.metricValues?.[2]?.value || 0),
            });
          }
          gaProjects.push({ project: projectName, data: dailyData });
        } catch (err) {
          // Log per-property error but continue with other properties
          console.error(`GA4 error for property ${propertyId} (${projectName}):`, err);
        }
      }
    } catch {
      // GA4 credentials invalid — continue with defaults
    }
  }

  // Enrich server agents with Brevo data (campaigns + contact lists)
  if (process.env.BREVO_API_KEY) {
    // 1) Campaign stats → email marketing agents
    if (brevoCampaigns.length > 0) {
      const campaignsByProject: Record<string, { sent: number; delivered: number; opened: number; clicked: number; latestDate: string }> = {};
      for (const c of brevoCampaigns) {
        if (c.status !== "sent") continue;
        if (!campaignsByProject[c.project]) {
          campaignsByProject[c.project] = { sent: 0, delivered: 0, opened: 0, clicked: 0, latestDate: "" };
        }
        const agg = campaignsByProject[c.project];
        agg.sent += c.sent;
        agg.delivered += c.delivered;
        agg.opened += c.opened;
        agg.clicked += c.clicked;
        if (c.sentDate && c.sentDate > agg.latestDate) agg.latestDate = c.sentDate;
      }
      for (const agent of serverAgents) {
        const projStats = campaignsByProject[agent.project];
        if (!projStats) continue;
        if (agent.period === "email_marketing" && agent.status === "pending") {
          agent.status = "active";
          agent.metrics = {
            emails_sent: projStats.sent,
            delivered: projStats.delivered,
            opened: projStats.opened,
            clicked: projStats.clicked,
          };
          const openRate = projStats.delivered > 0 ? ((projStats.opened / projStats.delivered) * 100).toFixed(1) : "0";
          const clickRate = projStats.delivered > 0 ? ((projStats.clicked / projStats.delivered) * 100).toFixed(1) : "0";
          agent.summary = locale === "zh"
            ? `已发送 ${projStats.sent} 封邮件，送达 ${projStats.delivered}，打开率 ${openRate}%，点击率 ${clickRate}%`
            : `Sent ${projStats.sent} emails, ${projStats.delivered} delivered, ${openRate}% open rate, ${clickRate}% click rate`;
          if (projStats.latestDate) agent.last_run = projStats.latestDate;
        }
      }
    }

    // 2) Contact lists → lead generation / prospecting agents
    try {
      const listsRes = await fetch("https://api.brevo.com/v3/contacts/lists?limit=50", {
        headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
      });
      if (listsRes.ok) {
        const listsData = await listsRes.json();
        const lists: { name: string; totalSubscribers: number; uniqueSubscribers: number }[] = listsData.lists || [];
        // Map lists to projects and aggregate contact counts
        // Brevo returns actual count in uniqueSubscribers (totalSubscribers is often 0)
        const leadsByProject: Record<string, number> = {};
        for (const list of lists) {
          const count = list.uniqueSubscribers || list.totalSubscribers;
          if (!count) continue;
          const project = detectProject(list.name.toLowerCase().replace(/\s+/g, "-"));
          leadsByProject[project] = (leadsByProject[project] || 0) + count;
        }
        for (const agent of serverAgents) {
          const leadCount = leadsByProject[agent.project];
          if (!leadCount) continue;
          if (agent.period === "lead_generation" && agent.status === "pending") {
            agent.status = "active";
            agent.metrics = { contacts_found: leadCount };
            agent.summary = locale === "zh"
              ? `已找到 ${leadCount} 个潜在客户联系人`
              : `Found ${leadCount} prospect contacts`;
          }
        }
      }
    } catch {
      // Brevo lists API unavailable — continue
    }
  }

  // 3) Enrich server agents with DB agent_reports data
  try {
    const dbReports = await sql`
      SELECT ar.task_name, ar.summary, ar.metrics, p.name as project_name
      FROM agent_reports ar
      JOIN projects p ON ar.project_id = p.id
      ORDER BY ar.created_at DESC
    `;
    // Build a map: task_name → latest report
    const reportByTask: Record<string, { summary: string; metrics: Record<string, unknown>; project: string }> = {};
    for (const r of dbReports) {
      const taskName = r.task_name as string;
      if (!reportByTask[taskName]) {
        reportByTask[taskName] = {
          summary: r.summary as string,
          metrics: (r.metrics as Record<string, unknown>) || {},
          project: r.project_name as string,
        };
      }
    }
    for (const agent of serverAgents) {
      const dbReport = reportByTask[agent.agent];
      if (!dbReport) continue;
      if (agent.status === "pending" && dbReport.summary && Object.keys(dbReport.metrics).length > 0) {
        agent.status = "active";
        agent.summary = dbReport.summary;
        // Filter out non-numeric fields for metrics display
        const numericMetrics: Record<string, number> = {};
        for (const [k, v] of Object.entries(dbReport.metrics)) {
          if (typeof v === "number") numericMetrics[k] = v;
        }
        if (Object.keys(numericMetrics).length > 0) {
          agent.metrics = numericMetrics;
        }
      }
    }
  } catch {
    // DB query failed — continue with existing data
  }

  // Fetch token usage (last 30 days) grouped by date and project
  let tokenUsage: { date: string; project: string; prompt_tokens: number; completion_tokens: number; total_tokens: number }[] = [];
  let tokenSummary = { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  try {
    const projectIds = userProjects.map((p) => p.id as number);
    if (projectIds.length > 0 || isAdmin || isEnterprise) {
      // Enterprise users see all token usage (like admin) since they pay for the platform
      const rows = (isAdmin || isEnterprise)
        ? await sql`
            SELECT DATE(tu.created_at) as date, COALESCE(p.name, 'General') as project,
              SUM(tu.prompt_tokens)::int as prompt_tokens,
              SUM(tu.completion_tokens)::int as completion_tokens,
              SUM(tu.total_tokens)::int as total_tokens
            FROM token_usage tu
            LEFT JOIN projects p ON tu.project_id = p.id
            WHERE tu.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(tu.created_at), COALESCE(p.name, 'General')
            ORDER BY date`
        : await sql`
            SELECT DATE(tu.created_at) as date, COALESCE(p.name, 'General') as project,
              SUM(tu.prompt_tokens)::int as prompt_tokens,
              SUM(tu.completion_tokens)::int as completion_tokens,
              SUM(tu.total_tokens)::int as total_tokens
            FROM token_usage tu
            LEFT JOIN projects p ON tu.project_id = p.id
            WHERE (tu.project_id = ANY(${projectIds}) OR tu.user_id = ${userId})
              AND tu.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(tu.created_at), COALESCE(p.name, 'General')
            ORDER BY date`;
      tokenUsage = rows.map((r) => ({
        date: (r.date as Date).toISOString().slice(0, 10),
        project: r.project as string,
        prompt_tokens: r.prompt_tokens as number,
        completion_tokens: r.completion_tokens as number,
        total_tokens: r.total_tokens as number,
      }));
      for (const r of rows) {
        tokenSummary.totalTokens += r.total_tokens as number;
        tokenSummary.promptTokens += r.prompt_tokens as number;
        tokenSummary.completionTokens += r.completion_tokens as number;
      }
    }
  } catch {
    // Token usage query failed — continue
  }

  return NextResponse.json({ reports, agents: [], serverAgents, brevoStats, brevoCampaigns, gaStats, gaProjects, tokenUsage, tokenSummary });
}
