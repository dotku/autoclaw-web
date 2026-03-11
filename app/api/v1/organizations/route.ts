import { NextRequest } from "next/server";
import { authenticateV1, apiSuccess } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/organizations
 * List organizations the user belongs to, with member counts.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateV1(req, "read");
  if ("status" in ctx) return ctx;

  const { sql, userId } = ctx;

  const orgs = await sql`
    SELECT o.id, o.name, o.domain, o.plan, o.created_at,
           om.role as user_role,
           (SELECT COUNT(*)::int FROM organization_members WHERE org_id = o.id) as member_count
    FROM organization_members om
    JOIN organizations o ON om.org_id = o.id
    WHERE om.user_id = ${userId}
    ORDER BY o.name ASC
  `;

  return apiSuccess({ organizations: orgs });
}
