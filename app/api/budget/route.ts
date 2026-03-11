import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureBudgetTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS user_budgets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      monthly_limit NUMERIC,
      total_limit NUMERIC,
      alert_thresholds INTEGER[] DEFAULT '{80,100}',
      auto_pause BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();
    await ensureBudgetTable();

    const email = session.user.email as string;
    const users = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return NextResponse.json({});
    }

    const userId = users[0].id;
    const rows = await sql`SELECT monthly_limit, total_limit, alert_thresholds, auto_pause FROM user_budgets WHERE user_id = ${userId}`;

    if (rows.length === 0) {
      return NextResponse.json({});
    }

    return NextResponse.json({
      monthly_limit: rows[0].monthly_limit != null ? Number(rows[0].monthly_limit) : null,
      total_limit: rows[0].total_limit != null ? Number(rows[0].total_limit) : null,
      alert_thresholds: rows[0].alert_thresholds || [80, 100],
      auto_pause: rows[0].auto_pause ?? true,
    });
  } catch (err) {
    console.error("Budget GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();
    await ensureBudgetTable();

    const email = session.user.email as string;
    const users = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = users[0].id;
    const body = await req.json();
    const monthlyLimit = body.monthly_limit != null ? Number(body.monthly_limit) : null;
    const totalLimit = body.total_limit != null ? Number(body.total_limit) : null;
    const alertThresholds: number[] = Array.isArray(body.alert_thresholds)
      ? body.alert_thresholds.filter((v: unknown) => typeof v === "number" && [50, 80, 100].includes(v as number))
      : [80, 100];
    const autoPause = body.auto_pause !== false;

    await sql`
      INSERT INTO user_budgets (user_id, monthly_limit, total_limit, alert_thresholds, auto_pause, updated_at)
      VALUES (${userId}, ${monthlyLimit}, ${totalLimit}, ${alertThresholds}, ${autoPause}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        monthly_limit = ${monthlyLimit},
        total_limit = ${totalLimit},
        alert_thresholds = ${alertThresholds},
        auto_pause = ${autoPause},
        updated_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Budget POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
