import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStripe, priceIdForPlan } from "@/lib/billing/stripe";
import { PLANS, type PlanId } from "@/lib/plans";
import { logEvent } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const plan = body?.plan as PlanId;
  if (!plan || !PLANS[plan] || plan === "free") {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const stripe = getStripe();
  const priceId = priceIdForPlan(plan);
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* env vars." },
      { status: 503 }
    );
  }

  let customerId = user.subscription?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.businessName || user.name,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await dbUpdateCustomerId(user.id, customerId);
  }

  const origin = process.env.APP_URL || req.headers.get("origin") || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
    success_url: `${origin}/app/billing?checkout=success`,
    cancel_url: `${origin}/app/billing?checkout=cancelled`,
  });

  logEvent(user.id, "checkout_started", { plan });
  return NextResponse.json({ url: session.url });
}

async function dbUpdateCustomerId(userId: string, customerId: string) {
  const { db } = await import("@/lib/db");
  await db.subscription.update({ where: { userId }, data: { stripeCustomerId: customerId } }).catch(() => {});
}
