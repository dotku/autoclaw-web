import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";

export const auth0 = new Auth0Client({
  async onCallback(error, ctx, session) {
    if (error || !session) {
      const base = ctx.appBaseUrl || "http://localhost:3000";
      return NextResponse.redirect(new URL(ctx.returnTo || "/", base));
    }

    // Log login event asynchronously (don't block the redirect)
    const email = session.user.email as string;
    try {
      const sql = getDb();
      const users = await sql`SELECT id FROM users WHERE email = ${email}`;
      let userId: number;
      if (users.length === 0) {
        const inserted = await sql`INSERT INTO users (email, name, auth0_id) VALUES (${email}, ${(session.user.name as string) || ""}, ${session.user.sub as string}) RETURNING id`;
        userId = inserted[0].id as number;
      } else {
        userId = users[0].id as number;
      }

      await logAudit({
        userId,
        userEmail: email,
        action: "login",
        resourceType: "session",
        details: { provider: session.user.sub?.split("|")[0] || "unknown" },
        ipAddress: "unknown",
      });
    } catch (e) {
      console.error("Login audit failed:", e);
    }

    const base = ctx.appBaseUrl || "http://localhost:3000";
    return NextResponse.redirect(new URL(ctx.returnTo || "/", base));
  },
});
