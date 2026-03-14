import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function generateReferralCode(): string {
  return crypto.randomBytes(6).toString("hex"); // 12 char hex code
}

async function ensureReferralTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      referred_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      referral_code VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      referred_email VARCHAR(255),
      commission_rate NUMERIC DEFAULT 0.05,
      created_at TIMESTAMP DEFAULT NOW(),
      converted_at TIMESTAMP
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code)`;
  await sql`
    CREATE TABLE IF NOT EXISTS referral_commissions (
      id SERIAL PRIMARY KEY,
      referral_id INTEGER REFERENCES referrals(id) ON DELETE CASCADE,
      referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC NOT NULL,
      currency VARCHAR(3) DEFAULT 'usd',
      payment_amount NUMERIC NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      stripe_payment_id VARCHAR(255),
      period VARCHAR(7),
      created_at TIMESTAMP DEFAULT NOW(),
      paid_at TIMESTAMP
    )
  `;
}

// GET: get referral stats and commission history
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
  await ensureReferralTables();

  const email = session.user.email as string;
  const users = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return NextResponse.json({ referralCode: null, stats: {}, commissions: [] });
  }

  const userId = users[0].id;

  // Get or create referral code for this user
  let referralRows = await sql`SELECT referral_code FROM referrals WHERE referrer_id = ${userId} AND referred_id IS NULL LIMIT 1`;
  let referralCode: string;

  if (referralRows.length === 0) {
    // Create a "seed" referral row that stores the user's code
    referralCode = generateReferralCode();
    await sql`INSERT INTO referrals (referrer_id, referral_code, status) VALUES (${userId}, ${referralCode}, 'seed')`;
  } else {
    referralCode = referralRows[0].referral_code as string;
  }

  // Stats
  const totalReferred = await sql`SELECT COUNT(*)::int as count FROM referrals WHERE referrer_id = ${userId} AND status != 'seed'`;
  const activeSubscribers = await sql`SELECT COUNT(*)::int as count FROM referrals WHERE referrer_id = ${userId} AND status = 'subscribed'`;
  const totalEarnings = await sql`SELECT COALESCE(SUM(amount), 0)::numeric as total FROM referral_commissions WHERE referrer_id = ${userId}`;
  const pendingPayout = await sql`SELECT COALESCE(SUM(amount), 0)::numeric as total FROM referral_commissions WHERE referrer_id = ${userId} AND status = 'pending'`;

  // Recent commissions
  const commissions = await sql`
    SELECT rc.*, r.referred_email
    FROM referral_commissions rc
    JOIN referrals r ON rc.referral_id = r.id
    WHERE rc.referrer_id = ${userId}
    ORDER BY rc.created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({
    referralCode,
    stats: {
      totalReferred: totalReferred[0].count,
      activeSubscribers: activeSubscribers[0].count,
      totalEarnings: Number(totalEarnings[0].total) / 100, // cents to dollars
      pendingPayout: Number(pendingPayout[0].total) / 100,
    },
    commissions: commissions.map((c) => ({
      id: c.id,
      referredEmail: c.referred_email,
      paymentAmount: Number(c.payment_amount) / 100,
      commission: Number(c.amount) / 100,
      currency: c.currency,
      status: c.status,
      period: c.period,
      createdAt: c.created_at,
    })),
  });
}

// POST: register a referral (called during signup with ?ref=CODE)
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRateLimit(ip, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const { action, referral_code, referred_email } = body;

  const sql = getDb();
  await ensureReferralTables();

  if (action === "register") {
    // A new user signed up with a referral code
    if (!referral_code || !referred_email) {
      return NextResponse.json({ error: "Missing referral_code or referred_email" }, { status: 400 });
    }

    // Find the referrer by code
    const seedRow = await sql`SELECT referrer_id, referral_code FROM referrals WHERE referral_code = ${referral_code} AND status = 'seed'`;
    if (seedRow.length === 0) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    const referrerId = seedRow[0].referrer_id;

    // Don't allow self-referral
    const referrer = await sql`SELECT email FROM users WHERE id = ${referrerId}`;
    if (referrer.length > 0 && referrer[0].email === referred_email) {
      return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
    }

    // Check if already referred
    const existing = await sql`SELECT id FROM referrals WHERE referrer_id = ${referrerId} AND referred_email = ${referred_email}`;
    if (existing.length > 0) {
      return NextResponse.json({ success: true, message: "Already referred" });
    }

    // Find referred user if they exist
    const referredUser = await sql`SELECT id FROM users WHERE email = ${referred_email}`;
    const referredId = referredUser.length > 0 ? referredUser[0].id : null;

    await sql`
      INSERT INTO referrals (referrer_id, referred_id, referral_code, status, referred_email)
      VALUES (${referrerId}, ${referredId}, ${referral_code}, ${referredId ? 'signed_up' : 'pending'}, ${referred_email})
    `;

    return NextResponse.json({ success: true });
  }

  if (action === "record_payment") {
    // Called by webhook when a referred user makes a payment
    const { referred_user_id, payment_amount, currency, stripe_payment_id, period } = body;
    if (!referred_user_id || !payment_amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Find referral for this user
    const referral = await sql`
      SELECT r.id, r.referrer_id, r.commission_rate
      FROM referrals r
      WHERE r.referred_id = ${referred_user_id} AND r.status IN ('signed_up', 'subscribed')
      LIMIT 1
    `;
    if (referral.length === 0) {
      return NextResponse.json({ success: true, message: "No referral found" });
    }

    const commissionRate = Number(referral[0].commission_rate) || 0.05;
    const commissionAmount = Math.round(payment_amount * commissionRate);

    // Update referral status
    await sql`UPDATE referrals SET status = 'subscribed', converted_at = COALESCE(converted_at, NOW()) WHERE id = ${referral[0].id}`;

    // Record commission
    await sql`
      INSERT INTO referral_commissions (referral_id, referrer_id, amount, currency, payment_amount, stripe_payment_id, period)
      VALUES (${referral[0].id}, ${referral[0].referrer_id}, ${commissionAmount}, ${currency || 'usd'}, ${payment_amount}, ${stripe_payment_id || null}, ${period || null})
    `;

    return NextResponse.json({ success: true, commission: commissionAmount });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
