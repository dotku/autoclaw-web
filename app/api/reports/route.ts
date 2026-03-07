import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { execSync } from "child_process";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export const dynamic = "force-dynamic";

interface CronJob {
  id: string;
  name: string;
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
  if (name.includes("medtravel")) return "MedTravel";
  if (name.includes("iris") || name.includes("limo")) return "Iris Limo";
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
  let users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    users = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${email}, ${(session.user.name as string) || ""}, ${session.user.sub as string}) RETURNING id, role`;
  }
  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";

  const userProjects = await sql`SELECT name, ga_property_id FROM projects WHERE user_id = ${userId}`;
  const userProjectNames = userProjects.map((p) => p.name as string);
  // Use first project name as default label for "General" jobs
  const defaultProjectName = userProjectNames[0] || "General";

  const { jobs, summaries } = readOpenClawData();

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

  // Admin sees all reports; regular users see only their project reports + General
  const reports = isAdmin
    ? allReports
    : allReports
        .filter((r) => r.project === "General" || matchesUserProject(r.project, userProjectNames))
        .map((r) => ({
          ...r,
          project: r.project === "General" ? defaultProjectName : r.project,
        }));

  // Fetch Brevo email statistics
  let brevoStats = { emailsSent: 0, delivered: 0, opened: 0, clicked: 0 };
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/statistics/aggregatedReport", {
        headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        brevoStats = {
          emailsSent: data.requests || 0,
          delivered: data.delivered || 0,
          opened: data.uniqueOpens || 0,
          clicked: data.uniqueClicks || 0,
        };
      }
    } catch {
      // Brevo API unavailable — continue with defaults
    }
  }

  // Fetch GA4 traffic statistics (last 30 days) — only for user's own GA properties
  let gaStats = { totalUsers: 0, sessions: 0, pageViews: 0 };
  const gaPropertyIds = userProjects
    .map((p) => p.ga_property_id as string)
    .filter(Boolean);
  if (process.env.GA_SERVICE_ACCOUNT_KEY && gaPropertyIds.length > 0) {
    try {
      const credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_KEY);
      const analyticsClient = new BetaAnalyticsDataClient({ credentials });
      // Aggregate stats across all user's GA properties
      for (const propertyId of gaPropertyIds) {
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
      }
    } catch {
      // GA4 API unavailable — continue with defaults
    }
  }

  return NextResponse.json({ reports, agents: [], brevoStats, gaStats });
}
