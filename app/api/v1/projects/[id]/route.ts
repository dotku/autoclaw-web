import { NextRequest } from "next/server";
import { authenticateV1, apiSuccess, apiError } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/projects/:id
 * Get a single project.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateV1(req, "read");
  if ("status" in ctx) return ctx;

  const { id } = await params;
  const { sql, userId } = ctx;
  const projectId = parseInt(id);
  if (isNaN(projectId)) return apiError("Invalid project ID", 400);

  const rows = await sql`
    SELECT p.id, p.name, p.website, p.description, p.domain, p.org_id, p.created_at,
           o.name as org_name
    FROM projects p
    LEFT JOIN organizations o ON p.org_id = o.id
    WHERE p.id = ${projectId} AND p.user_id = ${userId}
  `;

  if (rows.length === 0) return apiError("Project not found", 404);

  // Include agent assignments
  const agents = await sql`
    SELECT id, agent_type, status, config, created_at
    FROM agent_assignments
    WHERE project_id = ${projectId}
    ORDER BY created_at ASC
  `;

  return apiSuccess({ project: { ...rows[0], agents } });
}

/**
 * PATCH /api/v1/projects/:id
 * Update a project.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateV1(req, "write");
  if ("status" in ctx) return ctx;

  const { id } = await params;
  const { sql, userId } = ctx;
  const projectId = parseInt(id);
  if (isNaN(projectId)) return apiError("Invalid project ID", 400);

  // Verify ownership
  const existing = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}`;
  if (existing.length === 0) return apiError("Project not found", 404);

  const body = await req.json();
  const { name, website, description, domain } = body;

  const rows = await sql`
    UPDATE projects SET
      name = COALESCE(${name || null}, name),
      website = COALESCE(${website !== undefined ? website : null}, website),
      description = COALESCE(${description !== undefined ? description : null}, description),
      domain = COALESCE(${domain !== undefined ? domain : null}, domain)
    WHERE id = ${projectId} AND user_id = ${userId}
    RETURNING id, name, website, description, domain, org_id, created_at
  `;

  return apiSuccess({ project: rows[0] });
}

/**
 * DELETE /api/v1/projects/:id
 * Delete a project.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateV1(req, "write");
  if ("status" in ctx) return ctx;

  const { id } = await params;
  const { sql, userId } = ctx;
  const projectId = parseInt(id);
  if (isNaN(projectId)) return apiError("Invalid project ID", 400);

  const existing = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}`;
  if (existing.length === 0) return apiError("Project not found", 404);

  await sql`DELETE FROM projects WHERE id = ${projectId}`;

  return apiSuccess({ deleted: true });
}
