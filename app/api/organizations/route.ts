import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { orgActionSchema, parseOrError } from "@/lib/validations";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRateLimit(ip, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;

  const users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ orgs: [] });
  }

  const isAdmin = users[0].role === "admin";
  const userId = users[0].id;

  // Auto-join: if user's email domain matches an org's domain, add them as member automatically
  if (!isAdmin) {
    const emailDomain = email.split("@")[1] || "";
    if (emailDomain) {
      const domainOrgs = await sql`
        SELECT o.id FROM organizations o
        WHERE o.domain IS NOT NULL AND o.domain != '' AND o.domain = ${emailDomain}
          AND o.id NOT IN (SELECT org_id FROM organization_members WHERE user_id = ${userId})
      `;
      for (const org of domainOrgs) {
        await sql`INSERT INTO organization_members (org_id, user_id, role) VALUES (${org.id}, ${userId}, 'member')`;
      }
    }
  }

  const orgs = isAdmin
    ? await sql`
        SELECT o.*, om.role as member_role,
          (SELECT COUNT(*) FROM organization_members WHERE org_id = o.id) as member_count,
          (SELECT COUNT(*) FROM projects WHERE org_id = o.id) as project_count
        FROM organizations o
        LEFT JOIN organization_members om ON o.id = om.org_id AND om.user_id = ${userId}
        ORDER BY o.created_at DESC
      `
    : await sql`
        SELECT o.*, om.role as member_role,
          (SELECT COUNT(*) FROM organization_members WHERE org_id = o.id) as member_count,
          (SELECT COUNT(*) FROM projects WHERE org_id = o.id) as project_count
        FROM organizations o
        JOIN organization_members om ON o.id = om.org_id AND om.user_id = ${userId}
        ORDER BY o.created_at DESC
      `;

  return NextResponse.json({ orgs });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRateLimit(ip, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const email = session.user.email as string;

  const users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";

  const rawBody = await req.json();
  const parsed = parseOrError(orgActionSchema, rawBody);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;
  const { action } = body;

  if (action === "create") {
    const { name, domain } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check for duplicate org name
    const existing = await sql`SELECT id FROM organizations WHERE name = ${name}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Organization name already taken" }, { status: 409 });
    }

    const org = await sql`
      INSERT INTO organizations (name, domain, created_by)
      VALUES (${name}, ${domain || null}, ${userId})
      RETURNING id
    `;

    await sql`
      INSERT INTO organization_members (org_id, user_id, role)
      VALUES (${org[0].id}, ${userId}, 'admin')
    `;

    logAudit({ userId, userEmail: email, action: "org.create", resourceType: "organization", resourceId: org[0].id as number, details: { name, domain }, ipAddress: ip });
    return NextResponse.json({ org_id: org[0].id, message: "Organization created" });
  }

  if (action === "add_member") {
    const { org_id, email: memberEmail, role: memberRole } = body;
    if (!org_id || !memberEmail) {
      return NextResponse.json({ error: "org_id and email required" }, { status: 400 });
    }

    // Verify current user is org admin
    if (!isAdmin) {
      const membership = await sql`SELECT role FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}`;
      if (membership.length === 0 || membership[0].role !== "admin") {
        return NextResponse.json({ error: "Only org admins can add members" }, { status: 403 });
      }
    }

    // Find or create user
    let targetUser = await sql`SELECT id FROM users WHERE email = ${memberEmail}`;
    if (targetUser.length === 0) {
      targetUser = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${memberEmail}, '', '') RETURNING id`;
    }

    // Check if already a member
    const existing = await sql`SELECT id FROM organization_members WHERE org_id = ${org_id} AND user_id = ${targetUser[0].id}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    await sql`
      INSERT INTO organization_members (org_id, user_id, role)
      VALUES (${org_id}, ${targetUser[0].id}, ${memberRole || "member"})
    `;

    logAudit({ userId, userEmail: email, action: "org.add_member", resourceType: "organization", resourceId: org_id, details: { member_email: memberEmail }, ipAddress: ip });
    return NextResponse.json({ message: "Member added" });
  }

  if (action === "remove_member") {
    const { org_id, member_email } = body;
    if (!org_id || !member_email) {
      return NextResponse.json({ error: "org_id and member_email required" }, { status: 400 });
    }

    if (!isAdmin) {
      const membership = await sql`SELECT role FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}`;
      if (membership.length === 0 || membership[0].role !== "admin") {
        return NextResponse.json({ error: "Only org admins can remove members" }, { status: 403 });
      }
    }

    const targetUser = await sql`SELECT id FROM users WHERE email = ${member_email}`;
    if (targetUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await sql`DELETE FROM organization_members WHERE org_id = ${org_id} AND user_id = ${targetUser[0].id}`;

    logAudit({ userId, userEmail: email, action: "org.remove_member", resourceType: "organization", resourceId: org_id, details: { member_email }, ipAddress: ip });
    return NextResponse.json({ message: "Member removed" });
  }

  if (action === "assign_project") {
    const { org_id, project_id } = body;
    if (!org_id || !project_id) {
      return NextResponse.json({ error: "org_id and project_id required" }, { status: 400 });
    }

    // Verify user has access to the org
    if (!isAdmin) {
      const membership = await sql`SELECT role FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}`;
      if (membership.length === 0 || membership[0].role !== "admin") {
        return NextResponse.json({ error: "Only org admins can assign projects" }, { status: 403 });
      }
    }

    // Verify user owns the project
    const emailDomain = email.split("@")[1] || "";
    const proj = isAdmin
      ? await sql`SELECT id FROM projects WHERE id = ${project_id}`
      : await sql`SELECT id FROM projects WHERE id = ${project_id} AND (user_id = ${userId} OR id IN (SELECT project_id FROM project_members WHERE user_id = ${userId}) OR (domain IS NOT NULL AND domain != '' AND domain = ${emailDomain}))`;

    if (proj.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await sql`UPDATE projects SET org_id = ${org_id} WHERE id = ${project_id}`;

    logAudit({ userId, userEmail: email, action: "org.assign_project", resourceType: "project", resourceId: project_id, details: { org_id }, ipAddress: ip });
    return NextResponse.json({ message: "Project assigned to organization" });
  }

  if (action === "rename") {
    const { org_id, name: newName } = body;
    if (!org_id || !newName) {
      return NextResponse.json({ error: "org_id and name required" }, { status: 400 });
    }

    if (!isAdmin) {
      const membership = await sql`SELECT role FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}`;
      if (membership.length === 0 || membership[0].role !== "admin") {
        return NextResponse.json({ error: "Only org admins can rename organizations" }, { status: 403 });
      }
    }

    await sql`UPDATE organizations SET name = ${newName} WHERE id = ${org_id}`;

    logAudit({ userId, userEmail: email, action: "org.rename", resourceType: "organization", resourceId: org_id, details: { new_name: newName }, ipAddress: ip });
    return NextResponse.json({ message: "Organization renamed" });
  }

  if (action === "update_role") {
    const { org_id, member_email, role: newRole } = body;
    if (!org_id || !member_email || !newRole) {
      return NextResponse.json({ error: "org_id, member_email, and role required" }, { status: 400 });
    }
    if (newRole !== "admin" && newRole !== "member") {
      return NextResponse.json({ error: "Role must be admin or member" }, { status: 400 });
    }

    if (!isAdmin) {
      const membership = await sql`SELECT role FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}`;
      if (membership.length === 0 || membership[0].role !== "admin") {
        return NextResponse.json({ error: "Only org admins can change roles" }, { status: 403 });
      }
    }

    // Prevent self-demotion
    if (member_email === email && newRole !== "admin") {
      return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 });
    }

    const targetUser = await sql`SELECT id FROM users WHERE email = ${member_email}`;
    if (targetUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await sql`UPDATE organization_members SET role = ${newRole} WHERE org_id = ${org_id} AND user_id = ${targetUser[0].id}`;

    logAudit({ userId, userEmail: email, action: "org.update_role", resourceType: "organization", resourceId: org_id, details: { member_email, new_role: newRole }, ipAddress: ip });
    return NextResponse.json({ message: "Role updated" });
  }

  if (action === "delete") {
    const { org_id } = body;
    if (!org_id) {
      return NextResponse.json({ error: "org_id required" }, { status: 400 });
    }

    if (!isAdmin) {
      const membership = await sql`SELECT role FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}`;
      if (membership.length === 0 || membership[0].role !== "admin") {
        return NextResponse.json({ error: "Only org admins can delete organizations" }, { status: 403 });
      }
    }

    // Check no other members remain
    const otherMembers = await sql`SELECT COUNT(*) as cnt FROM organization_members WHERE org_id = ${org_id} AND user_id != ${userId}`;
    if (Number(otherMembers[0].cnt) > 0) {
      return NextResponse.json({ error: "Remove all other members before deleting" }, { status: 400 });
    }

    // Unassign projects from this org
    await sql`UPDATE projects SET org_id = NULL WHERE org_id = ${org_id}`;
    // Remove self from org
    await sql`DELETE FROM organization_members WHERE org_id = ${org_id}`;
    // Delete org
    await sql`DELETE FROM organizations WHERE id = ${org_id}`;

    logAudit({ userId, userEmail: email, action: "org.delete", resourceType: "organization", resourceId: org_id, details: {}, ipAddress: ip });
    return NextResponse.json({ message: "Organization deleted" });
  }

  if (action === "get_members") {
    const { org_id } = body;
    if (!org_id) {
      return NextResponse.json({ error: "org_id required" }, { status: 400 });
    }

    // Verify user has access to the org
    if (!isAdmin) {
      const membership = await sql`SELECT id FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}`;
      if (membership.length === 0) {
        return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
      }
    }

    const hiddenEmails = ["weij0201@gmail.com", "weijingjaylin@gmail.com"];

    const members = await sql`
      SELECT u.email, u.name, om.role, om.created_at
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE om.org_id = ${org_id}
        AND u.email != ALL(${hiddenEmails})
      ORDER BY CASE WHEN om.role = 'admin' THEN 0 ELSE 1 END, om.created_at ASC
    `;

    return NextResponse.json({ members });
  }

  if (action === "check_name") {
    const { name } = body as { action: string; name?: string };
    if (!name) {
      return NextResponse.json({ available: false });
    }
    const existing = await sql`SELECT id FROM organizations WHERE name = ${name}`;
    return NextResponse.json({ available: existing.length === 0 });
  }

  if (action === "join") {
    const { name } = body as { action: string; name?: string };
    if (!name) {
      return NextResponse.json({ error: "Organization name required" }, { status: 400 });
    }

    const org = await sql`SELECT id FROM organizations WHERE name = ${name}`;
    if (org.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const orgId = org[0].id as number;

    // Check if already a member
    const existing = await sql`SELECT id FROM organization_members WHERE org_id = ${orgId} AND user_id = ${userId}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Already a member" }, { status: 409 });
    }

    await sql`
      INSERT INTO organization_members (org_id, user_id, role)
      VALUES (${orgId}, ${userId}, 'member')
    `;

    logAudit({ userId, userEmail: email, action: "org.join", resourceType: "organization", resourceId: orgId, details: { name }, ipAddress: ip });
    return NextResponse.json({ message: "Joined organization" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
