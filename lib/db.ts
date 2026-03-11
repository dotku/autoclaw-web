import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

const PLAN_RANK: Record<string, number> = {
  starter: 0,
  growth: 1,
  scale: 2,
  enterprise: 3,
};

/**
 * Resolve a user's effective plan: the highest between their own plan
 * and any organization they belong to. Auto-syncs the users table if stale.
 */
export async function resolveUserPlan(sql: NeonQueryFunction<false, false>, userId: number, currentPlan: string, email?: string): Promise<string> {
  // Auto-join domain-matched orgs before resolving plan
  if (email) {
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

  const orgPlans = await sql`
    SELECT DISTINCT o.plan FROM organization_members om
    JOIN organizations o ON om.org_id = o.id
    WHERE om.user_id = ${userId} AND o.plan IS NOT NULL
  `;

  let best = currentPlan || "starter";
  for (const row of orgPlans) {
    const orgPlan = row.plan as string;
    if ((PLAN_RANK[orgPlan] ?? 0) > (PLAN_RANK[best] ?? 0)) {
      best = orgPlan;
    }
  }

  // Sync user record if org plan is higher
  if (best !== currentPlan) {
    await sql`UPDATE users SET plan = ${best} WHERE id = ${userId}`;
  }

  return best;
}
