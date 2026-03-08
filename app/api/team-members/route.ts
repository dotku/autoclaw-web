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

  // Find project names the current user has access to (owned, domain, or org)
  const userProjects = isAdmin
    ? await sql`SELECT DISTINCT name, domain FROM projects`
    : await sql`SELECT DISTINCT name, domain FROM projects WHERE user_id = ${userId} OR (domain IS NOT NULL AND domain != '' AND domain = ${emailDomain}) OR org_id IN (SELECT org_id FROM organization_members WHERE user_id = ${userId})`;

  if (userProjects.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const projectNames = userProjects.map((p) => p.name as string);
  const domains = userProjects.map((p) => p.domain as string).filter(Boolean);

  // Hide super admin from team member lists
  const hiddenEmails = ["weij0201@gmail.com", "weijingjaylin@gmail.com"];

  // Find all team members: users who own the same projects, match domain, or share an org
  const members = domains.length > 0
    ? await sql`
        SELECT DISTINCT ON (u.email) u.email, u.name, u.role, u.created_at
        FROM users u
        WHERE (u.id IN (SELECT user_id FROM projects WHERE name = ANY(${projectNames}))
           OR ${sql`split_part(u.email, '@', 2)`} = ANY(${domains})
           OR u.id IN (SELECT om2.user_id FROM organization_members om2 WHERE om2.org_id IN (SELECT org_id FROM organization_members WHERE user_id = ${userId})))
           AND u.email != ALL(${hiddenEmails})
        ORDER BY u.email, u.created_at ASC
      `
    : await sql`
        SELECT DISTINCT ON (u.email) u.email, u.name, u.role, u.created_at
        FROM users u
        WHERE (u.id IN (SELECT user_id FROM projects WHERE name = ANY(${projectNames}))
           OR u.id IN (SELECT om2.user_id FROM organization_members om2 WHERE om2.org_id IN (SELECT org_id FROM organization_members WHERE user_id = ${userId})))
           AND u.email != ALL(${hiddenEmails})
        ORDER BY u.email, u.created_at ASC
      `;

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

  // Verify the current user owns or has domain access to this project
  const users = await sql`SELECT id, role FROM users WHERE email = ${currentEmail}`;
  if (users.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";

  const proj = isAdmin
    ? await sql`SELECT id, domain FROM projects WHERE id = ${project_id}`
    : await sql`SELECT id, domain FROM projects WHERE id = ${project_id} AND (user_id = ${userId} OR (domain IS NOT NULL AND domain != '' AND domain = ${emailDomain}))`;

  if (proj.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check if invitee already exists
  let invitee = await sql`SELECT id FROM users WHERE email = ${inviteeEmail}`;
  if (invitee.length === 0) {
    // Create a placeholder user account
    invitee = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${inviteeEmail}, '', '') RETURNING id`;
  }

  const inviteeId = invitee[0].id;

  // Check if invitee already has access to this project
  const existingAccess = await sql`SELECT id FROM projects WHERE name = (SELECT name FROM projects WHERE id = ${project_id}) AND user_id = ${inviteeId}`;
  if (existingAccess.length > 0) {
    return NextResponse.json({ error: "User already has access" }, { status: 409 });
  }

  // If the project has a domain set, and the invitee's email matches, they already have access via domain
  const projectDomain = proj[0].domain as string | null;
  const inviteeDomain = inviteeEmail.split("@")[1] || "";
  if (projectDomain && projectDomain === inviteeDomain) {
    return NextResponse.json({ message: "User already has access via domain" });
  }

  // Create a project entry for the invitee
  const projectInfo = await sql`SELECT name, website, description, ga_property_id, domain FROM projects WHERE id = ${project_id}`;
  const p = projectInfo[0];
  await sql`INSERT INTO projects (user_id, name, website, description, ga_property_id, domain) VALUES (${inviteeId}, ${p.name}, ${p.website || ""}, ${p.description || ""}, ${p.ga_property_id || null}, ${p.domain || null})`;

  // TODO: Send invitation email via Brevo

  return NextResponse.json({ message: "Invitation sent" });
}
