import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const WORKER_URL = process.env.WORKER_URL || "https://autoclaw-worker.dotku.workers.dev";
const WORKER_AUTH_SECRET = process.env.WORKER_AUTH_SECRET;

export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!WORKER_URL || !WORKER_AUTH_SECRET) {
    return NextResponse.json({ error: "Worker not configured" }, { status: 500 });
  }

  const sql = getDb();
  const email = session.user.email as string;
  const { agent_id, task_index, action } = await req.json();

  // Verify user owns this agent
  const users = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = users[0].id;

  const agents = await sql`
    SELECT aa.id, aa.project_id FROM agent_assignments aa
    JOIN projects p ON aa.project_id = p.id
    WHERE aa.id = ${agent_id} AND p.user_id = ${userId}
  `;
  if (agents.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const endpoint = action === "run-all" ? "/run-all" : "/execute";
  const body = action === "run-all"
    ? { agent_id }
    : { agent_id, task_index, project_id: agents[0].project_id, user_id: userId };

  try {
    const workerRes = await fetch(`${WORKER_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_AUTH_SECRET}`,
      },
      body: JSON.stringify(body),
    });

    const result = await workerRes.json();
    return NextResponse.json(result, { status: workerRes.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Worker call failed: ${message}` }, { status: 502 });
  }
}
