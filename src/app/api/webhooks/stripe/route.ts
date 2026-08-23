import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";
import { logEvent } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error("stripe:signature_invalid", { err: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId || session.subscription === null) break;
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await applySubscription(userId, sub);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId ?? (await userIdFromCustomerId(sub.customer as string));
        if (userId) await applySubscription(userId, sub, false);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId ?? (await userIdFromCustomerId(sub.customer as string));
        if (userId) {
          await db.subscription.updateMany({
            where: { userId },
            data: { plan: "free", status: "canceled", stripeSubscriptionId: null },
          });
          logEvent(userId, "subscription_canceled");
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const userId = await userIdFromCustomerId(inv.customer as string);
        if (userId) {
          await db.subscription.updateMany({ where: { userId }, data: { status: "past_due" } });
          logEvent(userId, "payment_failed");
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error("stripe:handler_failed", { type: event.type, err: String(err) });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function userIdFromCustomerId(customerId: string): Promise<string | null> {
  const sub = await db.subscription.findUnique({ where: { stripeCustomerId: customerId }, select: { userId: true } });
  return sub?.userId ?? null;
}

async function applySubscription(userId: string, sub: Stripe.Subscription, upsertCustomer = true) {
  const priceId = sub.items.data[0]?.price.id ?? "";
  const plan = planFromPriceId(priceId) ?? "free";
  const item = sub.items.data[0];
  const currentPeriodEnd = (item as unknown as { current_period_end?: number }).current_period_end;

  await db.subscription.updateMany({
    where: { userId },
    data: {
      plan,
      status: mapStatus(sub.status),
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
  void upsertCustomer;
  logEvent(userId, "subscription_updated", { plan, status: sub.status });
}

function mapStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "active";
  }
}

function planFromPriceId(priceId: string): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return "agency";
  return null;
}
