import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import Stripe from "stripe";

const ADMIN_EMAILS = ["jay.lin@jytech.us", "leo.liu@jytech.us"];

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth0.getSession();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email as string)) {
    return null;
  }
  return session.user;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await req.json();
  const stripe = getStripe();

  if (action === "finalize") {
    const invoice = await stripe.invoices.finalizeInvoice(id);
    return NextResponse.json({ status: invoice.status, id: invoice.id });
  }

  if (action === "send") {
    const invoice = await stripe.invoices.sendInvoice(id);
    return NextResponse.json({ status: invoice.status, id: invoice.id });
  }

  if (action === "void") {
    const invoice = await stripe.invoices.voidInvoice(id);
    return NextResponse.json({ status: invoice.status, id: invoice.id });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
