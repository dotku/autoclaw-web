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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  const invoices = await stripe.invoices.list({ limit: 50 });

  return NextResponse.json({
    invoices: invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      customer_email: inv.customer_email,
      customer_name: inv.customer_name,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      due_date: inv.due_date,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      description: inv.description,
      lines: inv.lines.data.map((line) => ({
        description: line.description,
        amount: line.amount,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { customer_email, customer_name, items, due_days = 14, memo } = body;

  if (!customer_email || !items || items.length === 0) {
    return NextResponse.json(
      { error: "customer_email and items are required" },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  let customer;
  const existing = await stripe.customers.list({
    email: customer_email,
    limit: 1,
  });
  if (existing.data.length > 0) {
    customer = existing.data[0];
  } else {
    customer = await stripe.customers.create({
      email: customer_email,
      name: customer_name || undefined,
    });
  }

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: due_days,
    description: memo || undefined,
    auto_advance: false,
  });

  for (const item of items) {
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      description: item.description,
      amount: Math.round(item.amount * 100),
      currency: "usd",
    });
  }

  return NextResponse.json({
    id: invoice.id,
    status: invoice.status,
    message: "Invoice created as draft. Use finalize & send to deliver it.",
  });
}
