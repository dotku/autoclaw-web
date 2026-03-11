import { NextRequest } from "next/server";
import { authenticateV1, apiSuccess, apiError, parsePagination } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/projects
 * List user's projects.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateV1(req, "read");
  if ("status" in ctx) return ctx;

  const { sql, userId } = ctx;
  const { limit, offset } = parsePagination(req);

  const projects = await sql`
    SELECT p.id, p.name, p.website, p.description, p.domain, p.org_id, p.created_at,
           o.name as org_name
    FROM projects p
    LEFT JOIN organizations o ON p.org_id = o.id
    WHERE p.user_id = ${userId}
    ORDER BY p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql`SELECT COUNT(*)::int as total FROM projects WHERE user_id = ${userId}`;

  return apiSuccess({
    projects,
    total: countRows[0].total,
    limit,
    offset,
  });
}

/**
 * POST /api/v1/projects
 * Create a new project.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticateV1(req, "write");
  if ("status" in ctx) return ctx;

  const { sql, userId } = ctx;
  const body = await req.json();
  const { name, website, description, domain, org_id } = body;

  if (!name?.trim()) {
    return apiError("name is required", 400);
  }

  // If org_id provided, verify membership
  if (org_id) {
    const membership = await sql`
      SELECT 1 FROM organization_members WHERE org_id = ${org_id} AND user_id = ${userId}
    `;
    if (membership.length === 0) {
      return apiError("Not a member of this organization", 403);
    }
  }

  const rows = await sql`
    INSERT INTO projects (user_id, name, website, description, domain, org_id)
    VALUES (${userId}, ${name.trim()}, ${website || null}, ${description || null}, ${domain || null}, ${org_id || null})
    RETURNING id, name, website, description, domain, org_id, created_at
  `;

  return apiSuccess({ project: rows[0] }, 201);
}
