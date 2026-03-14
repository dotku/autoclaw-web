import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function ensurePartnersTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS business_partners (
      id SERIAL PRIMARY KEY,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      website VARCHAR(500),
      address TEXT,
      partner_type VARCHAR(50) DEFAULT 'partner',
      status VARCHAR(20) DEFAULT 'active',
      description TEXT,
      notes TEXT,
      tags TEXT[] DEFAULT '{}',
      logo_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE business_partners ADD COLUMN IF NOT EXISTS description TEXT`;
  await sql`ALTER TABLE business_partners ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)`;
  await sql`ALTER TABLE business_partners ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE business_partners ADD COLUMN IF NOT EXISTS discount VARCHAR(100)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_business_partners_name ON business_partners(name)`;

  // Seed default global partners
  await sql`
    INSERT INTO business_partners (name, website, partner_type, status, description, logo_url, discount)
    VALUES
      ('Numix XPilot', 'https://www.numix.co/numix-xpilot', 'partner', 'active', 'Tax Credits on Autopilot with Full Stack Accounting & CFO services by Numix', 'https://framerusercontent.com/images/MfxaJudXEVxeeht8WnKAsVFWXg.png', '10% off')
    ON CONFLICT (name) DO UPDATE SET
      logo_url = COALESCE(EXCLUDED.logo_url, business_partners.logo_url),
      discount = COALESCE(EXCLUDED.discount, business_partners.discount),
      description = COALESCE(EXCLUDED.description, business_partners.description)
  `;
}

// GET: list business partners (public access for active, admin sees all)
export async function GET(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRateLimit(ip, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const sql = getDb();
  await ensurePartnersTable();

  // Check if current user is admin (optional auth — unauthenticated users see active only)
  let isAdmin = false;
  const session = await auth0.getSession().catch(() => null);
  if (session?.user) {
    const email = session.user.email as string;
    const users = await sql`SELECT id, role FROM users WHERE email = ${email}`;
    isAdmin = users.length > 0 && users[0].role === "admin";
  }

  const search = req.nextUrl.searchParams.get("search") || "";
  const typeFilter = req.nextUrl.searchParams.get("partner_type");
  const statusFilter = req.nextUrl.searchParams.get("status");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  // For non-admin users, only show active partners
  const showAll = isAdmin;

  let partners;
  if (search) {
    const like = `%${search}%`;
    partners = await sql`
      SELECT * FROM business_partners
      WHERE (name ILIKE ${like} OR contact_person ILIKE ${like} OR email ILIKE ${like} OR description ILIKE ${like})
        ${!showAll ? sql`AND status = 'active'` : sql``}
        ${typeFilter ? sql`AND partner_type = ${typeFilter}` : sql``}
        ${statusFilter && showAll ? sql`AND status = ${statusFilter}` : sql``}
      ORDER BY updated_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
  } else {
    partners = await sql`
      SELECT * FROM business_partners
      WHERE 1=1
        ${!showAll ? sql`AND status = 'active'` : sql``}
        ${typeFilter ? sql`AND partner_type = ${typeFilter}` : sql``}
        ${statusFilter && showAll ? sql`AND status = ${statusFilter}` : sql``}
      ORDER BY updated_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
  }

  const totalRows = search
    ? await sql`
        SELECT COUNT(*)::int as count FROM business_partners
        WHERE (name ILIKE ${`%${search}%`} OR contact_person ILIKE ${`%${search}%`} OR email ILIKE ${`%${search}%`} OR description ILIKE ${`%${search}%`})
          ${!showAll ? sql`AND status = 'active'` : sql``}
          ${typeFilter ? sql`AND partner_type = ${typeFilter}` : sql``}
          ${statusFilter && showAll ? sql`AND status = ${statusFilter}` : sql``}
      `
    : await sql`
        SELECT COUNT(*)::int as count FROM business_partners
        WHERE 1=1
          ${!showAll ? sql`AND status = 'active'` : sql``}
          ${typeFilter ? sql`AND partner_type = ${typeFilter}` : sql``}
          ${statusFilter && showAll ? sql`AND status = ${statusFilter}` : sql``}
      `;

  const totalCount = totalRows[0].count;
  return NextResponse.json({
    partners,
    total: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    isAdmin,
  });
}

// POST: create, update, delete (admin only)
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRateLimit(ip, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await ensurePartnersTable();

  const userEmail = session.user.email as string;
  const users = await sql`SELECT id, role FROM users WHERE email = ${userEmail}`;
  if (users.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = users[0].id;
  const isAdmin = users[0].role === "admin";

  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { name, contact_person, email, phone, website, address, partner_type, status, description, notes, tags, logo_url, discount } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    await sql`
      INSERT INTO business_partners (created_by, name, contact_person, email, phone, website, address, partner_type, status, description, notes, tags, logo_url, discount)
      VALUES (${userId}, ${name}, ${contact_person || null}, ${email || null}, ${phone || null}, ${website || null}, ${address || null}, ${partner_type || "partner"}, ${status || "active"}, ${description || null}, ${notes || null}, ${tags || []}, ${logo_url || null}, ${discount || null})
    `;
    return NextResponse.json({ success: true });
  }

  if (action === "update") {
    const { id, name, contact_person, email, phone, website, address, partner_type, status, description, notes, tags, logo_url, discount } = body;

    if (!id) {
      return NextResponse.json({ error: "Partner ID required" }, { status: 400 });
    }

    await sql`
      UPDATE business_partners SET
        name = ${name || ""},
        contact_person = ${contact_person || null},
        email = ${email || null},
        phone = ${phone || null},
        website = ${website || null},
        address = ${address || null},
        partner_type = ${partner_type || "partner"},
        status = ${status || "active"},
        description = ${description || null},
        notes = ${notes || null},
        tags = ${tags || []},
        logo_url = ${logo_url || null},
        discount = ${discount || null},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Partner ID required" }, { status: 400 });
    await sql`DELETE FROM business_partners WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
