import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { inviteTeamMemberSchema, parseOrError } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;
  const emailDomain = email.split("@")[1] || "";

  const users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const isAdmin = users[0].role === "admin";
  const userId = users[0].id;

  // Find projects the current user has access to (owner, project_member, domain match, or org)
  const userProjects = isAdmin
    ? await sql`SELECT DISTINCT id, domain FROM projects`
    : await sql`
        SELECT DISTINCT p.id, p.domain FROM projects p
        WHERE p.user_id = ${userId}
          OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ${userId})
          OR (p.domain IS NOT NULL AND p.domain != '' AND p.domain = ${emailDomain})
          OR p.org_id IN (SELECT org_id FROM organization_members WHERE user_id = ${userId})
      `;

  if (userProjects.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const projectIds = userProjects.map((p) => p.id as number);
  const domains = userProjects.map((p) => p.domain as string).filter(Boolean);

  // Hide super admin from team member lists
  const hiddenEmails = ["weij0201@gmail.com", "weijingjaylin@gmail.com"];

  // Get project members with their roles
  const projectMemberRows = await sql`
    SELECT pm.project_id, pm.role as project_role, u.email, u.name, u.created_at
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ANY(${projectIds})
      AND u.email != ALL(${hiddenEmails})
  `;

  // Get project owners
  const ownerRows = await sql`
    SELECT p.id as project_id, u.email, u.name, u.created_at
    FROM projects p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ANY(${projectIds})
      AND u.email != ALL(${hiddenEmails})
  `;

  // Build a combined member list with roles
  const memberMap = new Map<string, { email: string; name: string; created_at: string; project_role: string; project_ids: number[] }>();

  for (const row of ownerRows) {
    const key = row.email as string;
    if (!memberMap.has(key)) {
      memberMap.set(key, { email: key, name: row.name as string, created_at: row.created_at as string, project_role: "owner", project_ids: [] });
    }
    memberMap.get(key)!.project_ids.push(row.project_id as number);
  }

  for (const row of projectMemberRows) {
    const key = row.email as string;
    if (!memberMap.has(key)) {
      memberMap.set(key, { email: key, name: row.name as string, created_at: row.created_at as string, project_role: row.project_role as string, project_ids: [] });
    } else if (memberMap.get(key)!.project_role !== "owner") {
      memberMap.get(key)!.project_role = row.project_role as string;
    }
    memberMap.get(key)!.project_ids.push(row.project_id as number);
  }

  // Also include domain-matched users
  if (domains.length > 0) {
    const domainUsers = await sql`
      SELECT u.email, u.name, u.created_at
      FROM users u
      WHERE ${sql`split_part(u.email, '@', 2)`} = ANY(${domains})
        AND u.email != ALL(${hiddenEmails})
    `;
    for (const row of domainUsers) {
      const key = row.email as string;
      if (!memberMap.has(key)) {
        memberMap.set(key, { email: key, name: row.name as string, created_at: row.created_at as string, project_role: "domain", project_ids: [] });
      }
    }
  }

  const members = Array.from(memberMap.values()).sort((a, b) => {
    const roleOrder: Record<string, number> = { owner: 0, admin: 1, operator: 2, member: 3, viewer: 4, domain: 5 };
    return (roleOrder[a.project_role] ?? 9) - (roleOrder[b.project_role] ?? 9);
  });

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const currentEmail = session.user.email as string;
  const emailDomain = currentEmail.split("@")[1] || "";
  const rawBody = await req.json();
  const parsed = parseOrError(inviteTeamMemberSchema, rawBody);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { email: inviteeEmail, project_id } = parsed.data;

  // Verify the current user owns or has access to this project
  const users = await sql`SELECT id, role FROM users WHERE email = ${currentEmail}`;
  if (users.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";

  const proj = isAdmin
    ? await sql`SELECT id, domain FROM projects WHERE id = ${project_id}`
    : await sql`
        SELECT id, domain FROM projects
        WHERE id = ${project_id}
          AND (user_id = ${userId}
            OR id IN (SELECT project_id FROM project_members WHERE user_id = ${userId} AND role = 'admin')
            OR (domain IS NOT NULL AND domain != '' AND domain = ${emailDomain}))
      `;

  if (proj.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // If the project has a domain set and the invitee's email matches, they already have access
  const projectDomain = proj[0].domain as string | null;
  const inviteeDomain = inviteeEmail.split("@")[1] || "";
  if (projectDomain && projectDomain === inviteeDomain) {
    return NextResponse.json({ message: "User already has access via domain" });
  }

  // Check if invitee already exists, if not create placeholder
  let invitee = await sql`SELECT id FROM users WHERE email = ${inviteeEmail}`;
  if (invitee.length === 0) {
    invitee = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${inviteeEmail}, '', '') RETURNING id`;
  }
  const inviteeId = invitee[0].id;

  // Check if already the project owner
  const isOwner = await sql`SELECT id FROM projects WHERE id = ${project_id} AND user_id = ${inviteeId}`;
  if (isOwner.length > 0) {
    return NextResponse.json({ error: "User is already the project owner" }, { status: 409 });
  }

  // Add to project_members (upsert)
  await sql`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (${project_id}, ${inviteeId}, 'member')
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;

  return NextResponse.json({ message: "Team member added" });
}

export async function PUT(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;
  const body = await req.json();
  const { project_id, member_email, role } = body as { project_id: number; member_email: string; role: string };

  if (!project_id || !member_email || !role) {
    return NextResponse.json({ error: "project_id, member_email, and role required" }, { status: 400 });
  }

  const validRoles = ["admin", "operator", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
  }

  const users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  if (users.length === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";

  // Only project owner or project admin can update roles
  const canManage = isAdmin
    ? true
    : (await sql`SELECT id FROM projects WHERE id = ${project_id} AND user_id = ${userId}`).length > 0
      || (await sql`SELECT id FROM project_members WHERE project_id = ${project_id} AND user_id = ${userId} AND role = 'admin'`).length > 0;

  if (!canManage) {
    return NextResponse.json({ error: "Only project owner or admin can update roles" }, { status: 403 });
  }

  const member = await sql`SELECT id FROM users WHERE email = ${member_email}`;
  if (member.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const memberId = member[0].id;

  // Can't change the project owner's role
  const ownerCheck = await sql`SELECT id FROM projects WHERE id = ${project_id} AND user_id = ${memberId}`;
  if (ownerCheck.length > 0) {
    return NextResponse.json({ error: "Cannot change project owner's role" }, { status: 400 });
  }

  await sql`
    UPDATE project_members SET role = ${role}
    WHERE project_id = ${project_id} AND user_id = ${memberId}
  `;

  return NextResponse.json({ message: "Role updated" });
}

export async function DELETE(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;
  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("project_id"));
  const memberEmail = url.searchParams.get("member_email");

  if (!projectId || !memberEmail) {
    return NextResponse.json({ error: "project_id and member_email required" }, { status: 400 });
  }

  const users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  if (users.length === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";

  // Only project owner or project admin can remove members
  const canManage = isAdmin
    ? true
    : (await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}`).length > 0
      || (await sql`SELECT id FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId} AND role = 'admin'`).length > 0;

  if (!canManage) {
    return NextResponse.json({ error: "Only project owner or admin can remove members" }, { status: 403 });
  }

  const member = await sql`SELECT id FROM users WHERE email = ${memberEmail}`;
  if (member.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await sql`DELETE FROM project_members WHERE project_id = ${projectId} AND user_id = ${member[0].id}`;

  return NextResponse.json({ message: "Member removed" });
}
