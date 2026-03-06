import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const AVAILABLE_AGENTS = [
  { type: "email_marketing", label: "Email Marketing", desc: "Cold outreach, follow-ups, newsletters" },
  { type: "seo_content", label: "SEO & Content", desc: "Blog posts, keyword optimization" },
  { type: "lead_prospecting", label: "Lead Prospecting", desc: "Find qualified B2B leads" },
  { type: "social_media", label: "Social Media", desc: "X/Twitter, LinkedIn automation" },
  { type: "product_manager", label: "Product Manager", desc: "Website health, conversion tracking" },
  { type: "sales_followup", label: "Sales Follow-up", desc: "CRM updates, lead nurturing" },
];

const AGENT_PLANS: Record<string, { plan: string; tasks: { name: string; status: string }[]; blockers: string[] }> = {
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

function matchAgentTypes(msg: string): string[] {
  const lower = msg.toLowerCase();
  const matched: string[] = [];
  for (const a of AVAILABLE_AGENTS) {
    if (
      lower.includes(a.type.replace(/_/g, " ")) ||
      lower.includes(a.label.toLowerCase()) ||
      (a.type === "email_marketing" && (lower.includes("email") || lower.includes("outreach") || lower.includes("newsletter"))) ||
      (a.type === "seo_content" && (lower.includes("seo") || lower.includes("blog") || lower.includes("content"))) ||
      (a.type === "lead_prospecting" && (lower.includes("lead") || lower.includes("prospect"))) ||
      (a.type === "social_media" && (lower.includes("social") || lower.includes("twitter") || lower.includes("linkedin"))) ||
      (a.type === "product_manager" && (lower.includes("product manager") || lower.includes("website health") || lower.includes("conversion"))) ||
      (a.type === "sales_followup" && (lower.includes("sales") || lower.includes("crm") || lower.includes("nurtur")))
    ) {
      matched.push(a.type);
    }
  }
  return matched;
}

const PLAN_AGENT_LIMITS: Record<string, number> = {
  starter: 2,
  growth: 10,
  scale: 999,
  enterprise: 999,
};

function getAgentLimit(plan: string): number {
  return PLAN_AGENT_LIMITS[plan] || 2;
}

function extractProjectInfo(msg: string): { name: string; website: string; description: string } | null {
  // Try to extract structured info from natural language
  const lines = msg.split(/\n/);
  let name = "";
  let website = "";
  let description = msg;

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith("name:") || lower.startsWith("company:") || lower.startsWith("product:")) {
      name = line.split(":").slice(1).join(":").trim();
    } else if (lower.startsWith("website:") || lower.startsWith("url:") || lower.startsWith("site:")) {
      website = line.split(":").slice(1).join(":").trim();
    } else if (lower.startsWith("description:") || lower.startsWith("desc:") || lower.startsWith("about:")) {
      description = line.split(":").slice(1).join(":").trim();
    }
  }

  // Try to extract URL from message
  if (!website) {
    const urlMatch = msg.match(/https?:\/\/[^\s]+/);
    if (urlMatch) website = urlMatch[0];
  }

  // Try to extract a name from common patterns
  if (!name) {
    const namePatterns = [
      /(?:called?|named?|name is|company is|product is|brand is)\s+["']?([^"'\n,]+)/i,
      /(?:create|add|new)\s+(?:a\s+)?(?:new\s+)?project\s+(?:called?|named?|for)?\s*["']?([^"'\n,]+)/i,
      /(?:I run|I have|we have|we run|I own)\s+(?:an?\s+)?([^.!?\n]+)/i,
    ];
    for (const pattern of namePatterns) {
      const match = msg.match(pattern);
      if (match) {
        name = match[1].trim().slice(0, 100);
        break;
      }
    }
  }

  if (name) {
    return { name, website, description };
  }
  return null;
}

// GET: load chat history
export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;

  const users = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  const projectId = req.nextUrl.searchParams.get("project_id");
  const messages = projectId
    ? await sql`SELECT id, role, content, agent_type, created_at FROM chat_messages WHERE user_id = ${users[0].id} AND project_id = ${parseInt(projectId)} ORDER BY created_at ASC LIMIT 100`
    : await sql`SELECT id, role, content, agent_type, created_at FROM chat_messages WHERE user_id = ${users[0].id} ORDER BY created_at ASC LIMIT 100`;

  return NextResponse.json({ messages });
}

// POST: send a message and execute actions
export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;
  const { message, project_id } = await req.json();

  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Find or create user
  let users = await sql`SELECT id, plan FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    users = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${email}, ${(session.user.name as string) || ""}, ${session.user.sub as string}) RETURNING id, plan`;
  }
  const userId = users[0].id;
  const userPlan = (users[0].plan as string) || "starter";
  const agentLimit = getAgentLimit(userPlan);

  // Save user message
  await sql`INSERT INTO chat_messages (user_id, project_id, role, content) VALUES (${userId}, ${project_id || null}, 'user', ${message})`;

  // Load context
  const projects = await sql`SELECT id, name, website, description FROM projects WHERE user_id = ${userId}`;
  const agents = await sql`
    SELECT aa.id, aa.agent_type, aa.status, aa.project_id, p.name as project_name
    FROM agent_assignments aa
    JOIN projects p ON aa.project_id = p.id
    WHERE p.user_id = ${userId}
  `;

  // Get last assistant message for context
  const lastAssistantMsg = await sql`SELECT content FROM chat_messages WHERE user_id = ${userId} AND role = 'assistant' ORDER BY created_at DESC LIMIT 1`;
  const lastReply = lastAssistantMsg.length > 0 ? (lastAssistantMsg[0].content as string).toLowerCase() : "";

  let reply: string;
  const lowerMsg = message.toLowerCase();
  const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|please|do it|go ahead|y|let's go|let's do it|absolutely|of course)\b/i.test(message.trim());

  // === CONTEXT: Handle affirmative responses based on last assistant message ===
  if (isAffirmative && lastReply.includes("would you like to assign agents") || isAffirmative && lastReply.includes("would you like to activate") || isAffirmative && lastReply.includes("which agents would you like to activate")) {
    // User said yes to assigning agents — activate all (within plan limit)
    if (projects.length > 0) {
      const targetProject = projects[projects.length - 1];
      const totalAgents = agents.length;
      const existingAgents = agents.filter((a) => a.project_id === targetProject.id).map((a) => a.agent_type);
      const newAgents = AVAILABLE_AGENTS.filter((a) => !existingAgents.includes(a.type));
      const slotsAvailable = agentLimit - totalAgents;
      const agentsToAdd = newAgents.slice(0, Math.max(0, slotsAvailable));

      if (slotsAvailable <= 0) {
        reply = `You've reached the **${agentLimit} agent limit** on your **${userPlan}** plan. Upgrade to add more agents:\n\n- **Growth** ($49/mo) — up to 10 agents\n- **Scale** ($149/mo) — unlimited agents`;
      } else {
        for (const agent of agentsToAdd) {
          const config = AGENT_PLANS[agent.type] || {};
          await sql`INSERT INTO agent_assignments (project_id, agent_type, status, config) VALUES (${targetProject.id}, ${agent.type}, 'active', ${JSON.stringify(config)})`;
        }

        const labels = agentsToAdd.map((a) => a.label);
        reply = `Activated for **${targetProject.name}**:\n${labels.map((l) => `- ${l}`).join("\n")}`;
        if (agentsToAdd.length < newAgents.length) {
          const skippedLabels = newAgents.slice(agentsToAdd.length).map((a) => a.label);
          reply += `\n\nCouldn't activate ${skippedLabels.join(", ")} — **${userPlan}** plan limit is ${agentLimit} agents. Upgrade to add more.`;
        }
        reply += `\n\nCheck the **Agents** tab for plans, execution progress, and blockers.`;
      }
    } else {
      reply = `You need a project first. Tell me about your business and I'll create one.`;
    }
  }
  // === ACTION: Rename project ===
  else if (lowerMsg.includes("rename")) {
    // Match patterns like "rename X to Y", "rename project X to Y", "rename demo to autoclaw"
    const renameMatch = message.match(/rename\s+(?:project\s+)?["']?(.+?)["']?\s+to\s+["']?(.+?)["']?\s*$/i);
    if (renameMatch && projects.length > 0) {
      const oldName = renameMatch[1].trim();
      const newName = renameMatch[2].trim();
      const project = projects.find((p) => p.name.toLowerCase() === oldName.toLowerCase())
        || projects.find((p) => p.name.toLowerCase().includes(oldName.toLowerCase()));
      if (project) {
        await sql`UPDATE projects SET name = ${newName} WHERE id = ${project.id} AND user_id = ${userId}`;
        reply = `Renamed project **"${oldName}"** to **"${newName}"**.`;
      } else {
        const projectList = projects.map((p) => `- ${p.name}`).join("\n");
        reply = `Couldn't find a project called "${oldName}". Your projects:\n\n${projectList}\n\nTry: "rename [old name] to [new name]"`;
      }
    } else if (projects.length === 0) {
      reply = `You don't have any projects to rename yet.`;
    } else {
      reply = `To rename a project, say: "rename [old name] to [new name]"\n\nExample: "rename demo to autoclaw-marketing"`;
    }
  }
  // === ACTION: Delete project ===
  else if (lowerMsg.includes("delete project") || lowerMsg.includes("remove project")) {
    const deleteMatch = message.match(/(?:delete|remove)\s+project\s+["']?(.+?)["']?\s*$/i);
    if (deleteMatch && projects.length > 0) {
      const targetName = deleteMatch[1].trim();
      const project = projects.find((p) => p.name.toLowerCase() === targetName.toLowerCase())
        || projects.find((p) => p.name.toLowerCase().includes(targetName.toLowerCase()));
      if (project) {
        await sql`DELETE FROM agent_assignments WHERE project_id = ${project.id}`;
        await sql`DELETE FROM chat_messages WHERE project_id = ${project.id}`;
        await sql`DELETE FROM projects WHERE id = ${project.id} AND user_id = ${userId}`;
        reply = `Deleted project **"${project.name}"** and all its agent assignments.`;
      } else {
        const projectList = projects.map((p) => `- ${p.name}`).join("\n");
        reply = `Couldn't find a project called "${targetName}". Your projects:\n\n${projectList}`;
      }
    } else if (projects.length === 0) {
      reply = `You don't have any projects to delete.`;
    } else {
      const projectList = projects.map((p) => `- ${p.name}`).join("\n");
      reply = `Which project would you like to delete? Your projects:\n\n${projectList}\n\nSay: "delete project [name]"`;
    }
  }
  // === ACTION: Create project ===
  else if (projects.length === 0 || lowerMsg.includes("create project") || lowerMsg.includes("new project") || lowerMsg.includes("add project") || lowerMsg.includes("create a") && lowerMsg.includes("project")) {
    // If no projects exist, treat any substantive message as project creation
    const info = extractProjectInfo(message);
    if (info && projects.length === 0) {
      // Auto-create project from description
      const newProject = await sql`INSERT INTO projects (user_id, name, website, description) VALUES (${userId}, ${info.name}, ${info.website}, ${info.description}) RETURNING id, name`;
      reply = `I've created your project **"${newProject[0].name}"**.\n\nNow let's set up your marketing agents. Available agents:\n\n${AVAILABLE_AGENTS.map((a) => `- **${a.label}** — ${a.desc}`).join("\n")}\n\nWhich agents would you like to activate? You can say "activate all" or pick specific ones like "email marketing and SEO".`;
    } else if (info && projects.length > 0) {
      const newProject = await sql`INSERT INTO projects (user_id, name, website, description) VALUES (${userId}, ${info.name}, ${info.website}, ${info.description}) RETURNING id, name`;
      reply = `Created new project **"${newProject[0].name}"**. Would you like to assign agents to it?`;
    } else if (projects.length === 0) {
      reply = `Welcome to AutoClaw! Tell me about your product or business and I'll set up a project for you.\n\nFor example: "I run an e-commerce store called GreenSkin selling organic skincare at https://greenskin.com"`;
    } else {
      reply = `To create a new project, tell me:\n1. **Name** of your product/company\n2. **Website URL** (optional)\n3. **Brief description**\n\nOr just describe your business.`;
    }
  }
  // === ACTION: Activate/assign agents ===
  else if (lowerMsg.includes("activate") || lowerMsg.includes("assign") || lowerMsg.includes("enable") || lowerMsg.includes("start agent") || lowerMsg.includes("add agent")) {
    if (projects.length === 0) {
      reply = `You need a project first before activating agents. Tell me about your business and I'll create one.`;
    } else {
      const targetProject = project_id
        ? projects.find((p) => p.id === project_id) || projects[projects.length - 1]
        : projects[projects.length - 1];

      const activateAll = lowerMsg.includes("all");
      const matchedTypes = activateAll
        ? AVAILABLE_AGENTS.map((a) => a.type)
        : matchAgentTypes(message);

      if (matchedTypes.length === 0) {
        reply = `I couldn't identify which agents you'd like to activate. Available agents:\n\n${AVAILABLE_AGENTS.map((a) => `- **${a.label}** — ${a.desc}`).join("\n")}\n\nPlease specify which ones, or say "activate all".`;
      } else {
        const totalAgents = agents.length;
        const slotsAvailable = agentLimit - totalAgents;
        const existingAgents = agents
          .filter((a) => a.project_id === targetProject.id)
          .map((a) => a.agent_type);

        const newAgents = matchedTypes.filter((t) => !existingAgents.includes(t));
        const skipped = matchedTypes.filter((t) => existingAgents.includes(t));
        const agentsToAdd = newAgents.slice(0, Math.max(0, slotsAvailable));
        const blocked = newAgents.slice(Math.max(0, slotsAvailable));

        if (slotsAvailable <= 0 && newAgents.length > 0) {
          reply = `You've reached the **${agentLimit} agent limit** on your **${userPlan}** plan. Upgrade to add more:\n\n- **Growth** ($49/mo) — up to 10 agents\n- **Scale** ($149/mo) — unlimited agents`;
        } else {
          for (const agentType of agentsToAdd) {
            const config = AGENT_PLANS[agentType] || {};
            await sql`INSERT INTO agent_assignments (project_id, agent_type, status, config) VALUES (${targetProject.id}, ${agentType}, 'active', ${JSON.stringify(config)})`;
          }

          const activatedLabels = agentsToAdd.map((t) => AVAILABLE_AGENTS.find((a) => a.type === t)?.label || t);
          const skippedLabels = skipped.map((t) => AVAILABLE_AGENTS.find((a) => a.type === t)?.label || t);
          const blockedLabels = blocked.map((t) => AVAILABLE_AGENTS.find((a) => a.type === t)?.label || t);

          let parts: string[] = [];
          if (activatedLabels.length > 0) {
            parts.push(`Activated for **${targetProject.name}**:\n${activatedLabels.map((l) => `- ${l}`).join("\n")}`);
          }
          if (skippedLabels.length > 0) {
            parts.push(`Already active: ${skippedLabels.join(", ")}`);
          }
          if (blockedLabels.length > 0) {
            parts.push(`Could not activate ${blockedLabels.join(", ")} — **${userPlan}** plan limit is ${agentLimit} agents. Upgrade for more.`);
          }
          parts.push(`\nCheck the **Agents** tab for execution plans, progress, and blockers.`);
          reply = parts.join("\n\n");
        }
      }
    }
  }
  // === ACTION: Deactivate/pause/remove agents ===
  else if (lowerMsg.includes("deactivate") || lowerMsg.includes("pause") || lowerMsg.includes("stop agent") || lowerMsg.includes("remove agent") || lowerMsg.includes("disable")) {
    const matchedTypes = matchAgentTypes(message);
    const deactivateAll = lowerMsg.includes("all");

    if (agents.length === 0) {
      reply = `You don't have any active agents to deactivate.`;
    } else if (deactivateAll) {
      await sql`UPDATE agent_assignments SET status = 'paused' WHERE project_id IN (SELECT id FROM projects WHERE user_id = ${userId}) AND status = 'active'`;
      reply = `All agents have been paused. You can reactivate them anytime by saying "activate all".`;
    } else if (matchedTypes.length > 0) {
      for (const agentType of matchedTypes) {
        await sql`UPDATE agent_assignments SET status = 'paused' WHERE project_id IN (SELECT id FROM projects WHERE user_id = ${userId}) AND agent_type = ${agentType} AND status = 'active'`;
      }
      const labels = matchedTypes.map((t) => AVAILABLE_AGENTS.find((a) => a.type === t)?.label || t);
      reply = `Paused: ${labels.join(", ")}. You can reactivate them anytime.`;
    } else {
      reply = `Which agents would you like to pause?\n\n${agents.filter((a) => a.status === "active").map((a) =>`- **${a.agent_type}** (${a.project_name})`).join("\n")}`;
    }
  }
  // === ACTION: Status/report ===
  else if (lowerMsg.includes("status") || lowerMsg.includes("report") || lowerMsg.includes("how are") || lowerMsg.includes("what's running") || lowerMsg.includes("show agent")) {
    if (agents.length === 0 && projects.length === 0) {
      reply = `You don't have any projects or agents set up yet. Tell me about your business to get started!`;
    } else if (agents.length === 0) {
      reply = `You have ${projects.length} project(s) but no agents assigned yet. Would you like me to activate agents? Available:\n\n${AVAILABLE_AGENTS.map((a) => `- **${a.label}** — ${a.desc}`).join("\n")}\n\nSay "activate all" or pick specific ones.`;
    } else {
      const activeAgents = agents.filter((a) => a.status === "active");
      const pausedAgents = agents.filter((a) => a.status === "paused");

      let parts: string[] = [];
      if (activeAgents.length > 0) {
        parts.push(`**Active agents:**\n${activeAgents.map((a) =>`- ${a.agent_type} (${a.project_name})`).join("\n")}`);
      }
      if (pausedAgents.length > 0) {
        parts.push(`**Paused agents:**\n${pausedAgents.map((a) =>`- ${a.agent_type} (${a.project_name})`).join("\n")}`);
      }
      parts.push(`\nCheck the **Agents** tab for detailed reports.`);
      reply = parts.join("\n\n");
    }
  }
  // === ACTION: List projects ===
  else if (lowerMsg.includes("project") || lowerMsg.includes("my project")) {
    if (projects.length === 0) {
      reply = `You don't have any projects yet. Tell me about your business and I'll create one.`;
    } else {
      const projectList = projects.map((p) =>
        `- **${p.name}**${p.website ? ` (${p.website})` : ""}${p.description ? ` — ${p.description.slice(0, 80)}` : ""}`
      ).join("\n");
      reply = `Your projects:\n\n${projectList}\n\nSay "create project" to add another, or ask about agent status.`;
    }
  }
  // === ACTION: List available agents ===
  else if (lowerMsg.includes("agent") || lowerMsg.includes("marketing") || lowerMsg.includes("what can you") || lowerMsg.includes("help")) {
    reply = `Available AI marketing agents:\n\n${AVAILABLE_AGENTS.map((a) => `- **${a.label}** — ${a.desc}`).join("\n")}\n\n`;
    if (projects.length > 0) {
      reply += `Say "activate [agent name]" or "activate all" to assign agents to your project **${projects[projects.length - 1].name}**.`;
    } else {
      reply += `First, tell me about your business so I can create a project, then we'll activate agents.`;
    }
  }
  // === DEFAULT: Try to create project from description if none exist ===
  else if (projects.length === 0 && message.length > 10) {
    const info = extractProjectInfo(message);
    if (info) {
      const newProject = await sql`INSERT INTO projects (user_id, name, website, description) VALUES (${userId}, ${info.name}, ${info.website}, ${info.description}) RETURNING id, name`;
      reply = `I've created your project **"${newProject[0].name}"**.\n\nLet's set up your marketing agents! Available:\n\n${AVAILABLE_AGENTS.map((a) => `- **${a.label}** — ${a.desc}`).join("\n")}\n\nSay "activate all" or pick specific agents like "email marketing and SEO".`;
    } else {
      reply = `Thanks for your message! To get started, tell me your company/product name and what you do. For example:\n\n"My company is TechFlow, we build project management tools at https://techflow.io"`;
    }
  }
  // === DEFAULT fallback ===
  else {
    reply = `I can help you with:\n\n- **Create a project** — "Create a new project called [name]"\n- **Rename a project** — "Rename demo to autoclaw-marketing"\n- **Delete a project** — "Delete project demo"\n- **Activate agents** — "Activate email marketing and SEO"\n- **Check status** — "Show me agent status"\n- **Pause agents** — "Pause email marketing"\n- **List projects** — "Show my projects"\n\nWhat would you like to do?`;
  }

  // Save agent reply
  await sql`INSERT INTO chat_messages (user_id, project_id, role, content, agent_type) VALUES (${userId}, ${project_id || null}, 'assistant', ${reply}, 'autoclaw')`;

  return NextResponse.json({ reply });
}
