import { NextRequest } from "next/server";
import { authenticateV1, apiSuccess } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me
 * Returns the authenticated user's profile, plan, and usage stats.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateV1(req, "read");
  if ("status" in ctx) return ctx;

  const { sql, userId, plan, scopes } = ctx;

  // User info
  const users = await sql`SELECT id, email, name, plan, created_at FROM users WHERE id = ${userId}`;
  const user = users[0];

  // Today's usage
  const today = new Date().toISOString().slice(0, 10);
  const usageRows = await sql`
    SELECT COALESCE(SUM(total_tokens), 0)::int as total_tokens,
           COALESCE(SUM(prompt_tokens), 0)::int as prompt_tokens,
           COALESCE(SUM(completion_tokens), 0)::int as completion_tokens,
           COUNT(*)::int as request_count
    FROM token_usage
    WHERE user_id = ${userId} AND created_at::date = ${today}::date
  `;

  // Document count
  const docCount = await sql`SELECT COUNT(*)::int as count FROM kb_documents WHERE user_id = ${userId}`;

  // Org memberships
  const orgCount = await sql`SELECT COUNT(*)::int as count FROM organization_members WHERE user_id = ${userId}`;

  // Project count
  const projectCount = await sql`SELECT COUNT(*)::int as count FROM projects WHERE user_id = ${userId}`;

  return apiSuccess({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan,
      created_at: user.created_at,
    },
    scopes,
    usage: {
      today: {
        total_tokens: usageRows[0].total_tokens,
        prompt_tokens: usageRows[0].prompt_tokens,
        completion_tokens: usageRows[0].completion_tokens,
        request_count: usageRows[0].request_count,
      },
    },
    counts: {
      documents: docCount[0].count,
      organizations: orgCount[0].count,
      projects: projectCount[0].count,
    },
  });
}
