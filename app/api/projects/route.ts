import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const PLAN_AGENT_LIMITS: Record<string, number> = {
  starter: 2,
  growth: 10,
  scale: 999,
  enterprise: 999,
};

const AGENT_PLANS: Record<string, object> = {
  email_marketing: {
    plan: "Set up cold outreach campaign with personalized templates, build prospect email list, configure follow-up sequences, and launch newsletter.",
    tasks: [
      { name: "Research target audience & ICP", status: "in_progress" },
      { name: "Build prospect email list (500+ contacts)", status: "pending" },
      { name: "Create email templates (cold, follow-up, newsletter)", status: "pending" },
      { name: "Configure sending schedule & limits", status: "pending" },
      { name: "Set up tracking (opens, clicks, replies)", status: "pending" },
      { name: "Launch first outreach campaign", status: "pending" },
    ],
    blockers: ["Need SMTP/email service credentials (SendGrid, Mailgun, etc.)", "Need target audience definition or ICP document"],
  },
  seo_content: {
    plan: "Audit existing website SEO, research high-value keywords, create content calendar, and produce optimized blog posts.",
    tasks: [
      { name: "Crawl website & audit current SEO health", status: "in_progress" },
      { name: "Keyword research (50+ target keywords)", status: "pending" },
      { name: "Competitor content analysis", status: "pending" },
      { name: "Create monthly content calendar", status: "pending" },
      { name: "Write first 3 SEO-optimized blog posts", status: "pending" },
      { name: "Set up rank tracking & analytics", status: "pending" },
    ],
    blockers: ["Need website URL for site audit", "Need Google Search Console access for keyword data"],
  },
  lead_prospecting: {
    plan: "Define ideal customer profile, build lead database from multiple sources, score and qualify leads, deliver enriched lead lists.",
    tasks: [
      { name: "Define ICP and qualification criteria", status: "in_progress" },
      { name: "Set up data sources (LinkedIn, Apollo, etc.)", status: "pending" },
      { name: "Build initial lead list (200+ leads)", status: "pending" },
      { name: "Enrich leads with company & contact data", status: "pending" },
      { name: "Score and prioritize leads", status: "pending" },
      { name: "Deliver qualified lead report", status: "pending" },
    ],
    blockers: ["Need ideal customer profile (industry, company size, title)", "Need LinkedIn Sales Navigator or Apollo.io access"],
  },
  social_media: {
    plan: "Set up brand social profiles, create content strategy, schedule posts, and engage with target audience on X/Twitter and LinkedIn.",
    tasks: [
      { name: "Audit existing social presence", status: "in_progress" },
      { name: "Create brand voice & content guidelines", status: "pending" },
      { name: "Build 2-week content queue (posts, threads)", status: "pending" },
      { name: "Set up scheduling tool integration", status: "pending" },
      { name: "Launch engagement campaign (likes, replies, follows)", status: "pending" },
      { name: "Track follower growth & engagement metrics", status: "pending" },
    ],
    blockers: ["Need X/Twitter API credentials", "Need LinkedIn page admin access"],
  },
  product_manager: {
    plan: "Monitor website health, analyze user behavior, track conversion funnels, and identify optimization opportunities.",
    tasks: [
      { name: "Set up website monitoring (uptime, speed)", status: "in_progress" },
      { name: "Install analytics tracking", status: "pending" },
      { name: "Map conversion funnels", status: "pending" },
      { name: "Run initial UX audit", status: "pending" },
      { name: "Identify top 5 conversion blockers", status: "pending" },
      { name: "Create optimization roadmap", status: "pending" },
    ],
    blockers: ["Need website URL", "Need Google Analytics access"],
  },
  sales_followup: {
    plan: "Integrate with CRM, set up lead nurture sequences, automate follow-up reminders, and track deal pipeline.",
    tasks: [
      { name: "Connect to CRM (HubSpot, Salesforce, etc.)", status: "pending" },
      { name: "Import existing leads & deals", status: "pending" },
      { name: "Create follow-up email sequences", status: "pending" },
      { name: "Set up automated reminders", status: "pending" },
      { name: "Configure deal stage tracking", status: "pending" },
      { name: "Launch first nurture campaign", status: "pending" },
    ],
    blockers: ["Need CRM API credentials", "Need current sales pipeline data"],
  },
};

// GET: list user's projects with agent counts
export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;

  const users = await sql`SELECT id, plan FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ projects: [], plan: "starter", agentLimit: 2, totalAgents: 0 });
  }

  const userId = users[0].id;
  const plan = (users[0].plan as string) || "starter";
  const agentLimit = PLAN_AGENT_LIMITS[plan] || 2;

  const projects = await sql`SELECT id, name, website, description, created_at FROM projects WHERE user_id = ${userId} ORDER BY created_at DESC`;
  const totalAgents = await sql`SELECT COUNT(*)::int as count FROM agent_assignments aa JOIN projects p ON aa.project_id = p.id WHERE p.user_id = ${userId}`;

  return NextResponse.json({
    projects,
    plan,
    agentLimit,
    totalAgents: totalAgents[0].count,
  });
}

// POST: create project or manage agents
export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;
  const body = await req.json();
  const { action } = body;

  let users = await sql`SELECT id, plan FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    users = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${email}, ${(session.user.name as string) || ""}, ${session.user.sub as string}) RETURNING id, plan`;
  }
  const userId = users[0].id;
  const plan = (users[0].plan as string) || "starter";
  const agentLimit = PLAN_AGENT_LIMITS[plan] || 2;

  if (action === "create_project") {
    const { name, website, description } = body;
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }
    const project = await sql`INSERT INTO projects (user_id, name, website, description) VALUES (${userId}, ${name}, ${website || ""}, ${description || ""}) RETURNING id, name, website, description, created_at`;
    return NextResponse.json({ project: project[0] });
  }

  if (action === "activate_agent") {
    const { project_id, agent_type } = body;
    if (!project_id || !agent_type) {
      return NextResponse.json({ error: "project_id and agent_type required" }, { status: 400 });
    }
    // Verify project ownership
    const proj = await sql`SELECT id FROM projects WHERE id = ${project_id} AND user_id = ${userId}`;
    if (proj.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    // Check limit
    const totalAgents = await sql`SELECT COUNT(*)::int as count FROM agent_assignments aa JOIN projects p ON aa.project_id = p.id WHERE p.user_id = ${userId}`;
    if (totalAgents[0].count >= agentLimit) {
      return NextResponse.json({ error: `Agent limit reached (${agentLimit} on ${plan} plan). Upgrade to add more.` }, { status: 403 });
    }
    // Check duplicate
    const existing = await sql`SELECT id FROM agent_assignments WHERE project_id = ${project_id} AND agent_type = ${agent_type}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Agent already assigned" }, { status: 409 });
    }
    const config = AGENT_PLANS[agent_type] || {};
    await sql`INSERT INTO agent_assignments (project_id, agent_type, status, config) VALUES (${project_id}, ${agent_type}, 'active', ${JSON.stringify(config)})`;
    return NextResponse.json({ success: true });
  }

  if (action === "deactivate_agent") {
    const { agent_id } = body;
    // Verify ownership
    const agent = await sql`SELECT aa.id FROM agent_assignments aa JOIN projects p ON aa.project_id = p.id WHERE aa.id = ${agent_id} AND p.user_id = ${userId}`;
    if (agent.length === 0) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    await sql`DELETE FROM agent_assignments WHERE id = ${agent_id}`;
    return NextResponse.json({ success: true });
  }

  if (action === "delete_project") {
    const { project_id } = body;
    const proj = await sql`SELECT id FROM projects WHERE id = ${project_id} AND user_id = ${userId}`;
    if (proj.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    await sql`DELETE FROM agent_assignments WHERE project_id = ${project_id}`;
    await sql`DELETE FROM chat_messages WHERE project_id = ${project_id}`;
    await sql`DELETE FROM projects WHERE id = ${project_id}`;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
