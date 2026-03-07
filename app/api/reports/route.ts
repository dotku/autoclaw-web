import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;

  // Find or create user
  let users = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    users = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${email}, ${(session.user.name as string) || ""}, ${session.user.sub as string}) RETURNING id`;
  }
  const userId = users[0].id;

  // Get reports for this user's projects
  const reports = await sql`
    SELECT ar.id, ar.agent_type as agent, ar.task_name, ar.summary, ar.metrics, ar.created_at,
           aa.status, p.name as project_name
    FROM agent_reports ar
    JOIN agent_assignments aa ON ar.agent_assignment_id = aa.id
    JOIN projects p ON ar.project_id = p.id
    WHERE p.user_id = ${userId}
    ORDER BY ar.created_at DESC
    LIMIT 50
  `;

  // Get active agent assignments
  const agents = await sql`
    SELECT aa.id, aa.agent_type, aa.status, aa.config, aa.project_id, p.name as project_name
    FROM agent_assignments aa
    JOIN projects p ON aa.project_id = p.id
    WHERE p.user_id = ${userId}
    ORDER BY aa.created_at DESC
  `;

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      agent: r.agent,
      period: r.task_name || "",
      summary: r.summary,
      metrics: r.metrics || {},
      status: r.status,
      project: r.project_name,
      last_run: r.created_at,
    })),
    agents,
  });
}
