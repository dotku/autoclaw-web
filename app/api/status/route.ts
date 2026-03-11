import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb, resolveUserPlan } from "@/lib/db";
import { getUsageStats } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

const DAILY_LIMIT_CENTS: Record<string, number> = {
  starter: 100,     // $1.00
  growth: 5000,     // $50.00
  scale: 50000,     // $500.00
  enterprise: 0,    // unlimited
};

const COST_PER_M: Record<string, { input: number; output: number }> = {
  cerebras: { input: 0, output: 0 },
  nvidia: { input: 0, output: 0 },
  google: { input: 10, output: 40 },
  openai: { input: 15, output: 60 },
  anthropic: { input: 300, output: 1500 },
};

// Free tier daily token limits (approximate tokens for $1 at Gemini Flash rates)
const FREE_DAILY_TOKENS: Record<string, number> = {
  starter: 1_000_000,    // ~$1 worth at Gemini Flash
  growth: 50_000_000,
  scale: 500_000_000,
  enterprise: 0,         // unlimited
};

export async function GET() {
  const sql = getDb();

  const [totals, today, byProvider, last7Days, userCount, embeddingUsage] = await Promise.all([
    sql`SELECT
      COALESCE(SUM(prompt_tokens), 0)::bigint as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::bigint as completion_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
      COUNT(*)::int as request_count
    FROM token_usage`,

    sql`SELECT
      COALESCE(SUM(prompt_tokens), 0)::bigint as prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::bigint as completion_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
      COUNT(*)::int as request_count
    FROM token_usage
    WHERE created_at::date = CURRENT_DATE`,

    sql`SELECT
      provider,
      COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
      COUNT(*)::int as request_count
    FROM token_usage
    GROUP BY provider
    ORDER BY SUM(total_tokens) DESC`,

    sql`SELECT
      DATE(created_at) as date,
      COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
      COUNT(*)::int as request_count
    FROM token_usage
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC`,

    sql`SELECT COUNT(*)::int as count FROM users`,

    getUsageStats(sql),
  ]);

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

  const response: Record<string, unknown> = {
    allTime: totals[0],
    today: today[0],
    byProvider,
    last7Days,
    users: userCount[0].count,
    nextResetUtc: nextReset.toISOString(),
    embedding: embeddingUsage,
  };

  // If logged in, add per-user quota info
  try {
    const session = await auth0.getSession();
    if (session?.user) {
      const email = session.user.email as string;
      const users = await sql`SELECT id, plan FROM users WHERE email = ${email}`;
      if (users.length > 0) {
        const userId = users[0].id;
        const userPlan = await resolveUserPlan(sql, userId, (users[0].plan as string) || "starter", email);

        const userToday = await sql`
          SELECT provider, SUM(prompt_tokens)::bigint as prompt_tokens, SUM(completion_tokens)::bigint as completion_tokens, SUM(total_tokens)::bigint as total_tokens, COUNT(*)::int as request_count
          FROM token_usage
          WHERE user_id = ${userId} AND created_at::date = CURRENT_DATE
          GROUP BY provider
        `;

        let totalSpendCents = 0;
        let totalTokensToday = 0;
        for (const row of userToday) {
          const cost = COST_PER_M[row.provider as string] || COST_PER_M.google;
          totalSpendCents += ((Number(row.prompt_tokens)) * cost.input + (Number(row.completion_tokens)) * cost.output) / 1_000_000;
          totalTokensToday += Number(row.total_tokens);
        }

        const dailyLimitCents = DAILY_LIMIT_CENTS[userPlan] || 100;
        const dailyTokenLimit = FREE_DAILY_TOKENS[userPlan] || 1_000_000;

        response.user = {
          plan: userPlan,
          todayTokens: totalTokensToday,
          todaySpendCents: Math.round(totalSpendCents * 100) / 100,
          dailyLimitCents: dailyLimitCents,
          dailyTokenLimit: dailyTokenLimit,
          remaining: dailyLimitCents > 0 ? Math.max(0, dailyLimitCents - totalSpendCents) : null,
          remainingTokens: dailyTokenLimit > 0 ? Math.max(0, dailyTokenLimit - totalTokensToday) : null,
          unlimited: dailyLimitCents === 0,
        };
      }
    }
  } catch {
    // Not logged in — that's fine, just return public data
  }

  return NextResponse.json(response);
}
