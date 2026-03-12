import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agent_id");
  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const sql = getDb();
  const email = session.user.email as string;

  // Verify user owns this agent
  const users = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = users[0].id;

  const agents = await sql`
    SELECT aa.id FROM agent_assignments aa
    JOIN projects p ON aa.project_id = p.id
    WHERE aa.id = ${agentId} AND p.user_id = ${userId}
  `;
  if (agents.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const reports = await sql`
    SELECT task_name, summary, metrics, created_at
    FROM agent_reports
    WHERE agent_assignment_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return NextResponse.json({
    reports: reports.map((r) => ({
      task_name: r.task_name,
      summary: r.summary,
      metrics: r.metrics || {},
      created_at: r.created_at,
    })),
  });
}
