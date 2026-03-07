import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { execSync } from "child_process";

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

function categorizeAgent(name: string): { category: string; project: string } {
  if (name.includes("gpulaw")) return { category: "engineering", project: "GPULaw" };
  if (name.includes("lead") || name.includes("prospect")) return { category: "lead_generation", project: "MedTravel" };
  if (name.includes("email") || name.includes("brevo")) return { category: "email_marketing", project: "MedTravel" };
  if (name.includes("seo") || name.includes("blog") || name.includes("backlink")) return { category: "seo", project: "MedTravel" };
  if (name.includes("tweet") || name.includes("x-") || name.includes("linkedin") || name.includes("marketing-tweet")) return { category: "social_media", project: "MedTravel" };
  if (name.includes("health") || name.includes("monitor") || name.includes("sre")) return { category: "monitoring", project: "MedTravel" };
  if (name.includes("standup") || name.includes("project") || name.includes("sprint")) return { category: "project_mgmt", project: "MedTravel" };
  if (name.includes("medchat")) return { category: "product", project: "MedChat" };
  if (name.includes("sienovo")) return { category: "marketing", project: "Sienovo" };
  return { category: "other", project: "MedTravel" };
}

function extractMetrics(text: string): Record<string, number> {
  const metrics: Record<string, number> = {};
  const patterns: [RegExp, string][] = [
    [/(\d+)\s*(?:new\s+)?leads?\s+(?:found|generated|imported)/i, "leads"],
    [/(\d+)\s*emails?\s+sent/i, "emails_sent"],
    [/(\d+)\s*(?:contacts?|emails?)\s+found/i, "contacts_found"],
    [/(\d+)\s*tweets?\s+(?:posted|sent|published)/i, "tweets"],
    [/(\d+)\s*(?:blog\s+)?posts?\s+(?:published|created)/i, "posts_published"],
    [/(\d+)\s*(?:articles?)\s+(?:published|written)/i, "articles"],
    [/(\d+)\s*PRs?\s+created/i, "prs_created"],
    [/subscribers?:\s*\*?\*?(\d+)/i, "subscribers"],
    [/CRM\s+leads?:\s*\*?\*?(\d+)/i, "crm_leads"],
    [/(\d+)%\s*(?:uptime|health)/i, "uptime_pct"],
    [/(\d+)\s*tasks?\s+completed/i, "tasks_completed"],
    [/(\d+)\s*(?:issues?|bugs?)\s+(?:found|opened|created)/i, "issues"],
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

    // Read latest session summary for each cron job
    const script = `
      const fs=require('fs'),p=require('path'),d='/home/node/.openclaw/agents/main/sessions';
      try{const ix=JSON.parse(fs.readFileSync(p.join(d,'sessions.json'),'utf8')),L={};
      for(const[k,v]of Object.entries(ix)){if(!v.label||!v.label.startsWith('Cron:'))continue;
      const n=v.label.replace('Cron: ','').trim();if(!L[n]||v.updatedAt>L[n].u)L[n]={u:v.updatedAt,s:v.sessionId};}
      const O={};for(const[n,i]of Object.entries(L)){try{const ls=fs.readFileSync(p.join(d,i.s+'.jsonl'),'utf8').trim().split('\\n');
      for(let j=ls.length-1;j>=0;j--){try{const e=JSON.parse(ls[j]),m=e.message||e;if(m.role==='assistant'){
      let t='';if(Array.isArray(m.content))m.content.forEach(c=>{if(c.type==='text')t+=c.text;});
      else if(typeof m.content==='string')t=m.content;if(t){O[n]=t.substring(0,1000);break;}}}catch{}}}catch{}}
      console.log(JSON.stringify(O));}catch{console.log('{}');}
    `.replace(/\n/g, "");

    const summariesRaw = execSync(
      `docker exec openclaw-gateway node -e "${script}"`,
      { timeout: 15000, encoding: "utf-8" }
    );
    const summaries = JSON.parse(summariesRaw.trim());

    return { jobs, summaries };
  } catch {
    return { jobs: [], summaries: {} };
  }
}

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobs, summaries } = readOpenClawData();

  const reports = jobs
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
        summary: summary || `Status: ${job.state.lastStatus || "unknown"}. Duration: ${durationSec}s.`,
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

  return NextResponse.json({ reports, agents: [] });
}
