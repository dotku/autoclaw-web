import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  const email = session.user.email;

  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) {
    return NextResponse.json({ invoices: [], subscriptions: [] });
  }

  const customer = customers.data[0];

  const [invoices, subscriptions] = await Promise.all([
    stripe.invoices.list({ customer: customer.id, limit: 20 }),
    stripe.subscriptions.list({ customer: customer.id, limit: 10 }),
  ]);

  return NextResponse.json({
    invoices: invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      description: inv.lines.data[0]?.description || "AutoClaw Subscription",
    })),
    subscriptions: subscriptions.data.map((sub) => ({
      id: sub.id,
      status: sub.status,
      current_period_start: (sub as unknown as { current_period_start: number }).current_period_start,
      current_period_end: (sub as unknown as { current_period_end: number }).current_period_end,
      plan: sub.items.data[0]?.price?.id,
      amount: sub.items.data[0]?.price?.unit_amount,
      interval: sub.items.data[0]?.price?.recurring?.interval,
      cancel_at_period_end: sub.cancel_at_period_end,
    })),
  });
}
