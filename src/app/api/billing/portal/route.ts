import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/billing/stripe";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();
  const customerId = user.subscription?.stripeCustomerId;
  if (!stripe || !customerId) {
    return NextResponse.json({ error: "No billing profile yet. Subscribe to a plan first." }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.APP_URL}/app/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
