import { db } from "./db";
import { logger } from "./logger";
import { logEvent } from "./analytics";
import { sendEmail } from "./email/sender";
import { renderTemplate, sequenceFor, type TemplateVars } from "./email/templates";
import { effectivePlan } from "./plans";

const BRANDING_FOOTER = "\n\n—\nChased automatically by Paidhound. Stop chasing, start getting paid.";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export interface InvoiceFull {
  id: string;
  userId: string;
  number: string;
  amountCents: number;
  currency: string;
  dueAt: Date;
  status: string;
  chasingEnabled: boolean;
  paymentUrl: string | null;
  customer: { name: string; email: string };
  user: {
    id: string;
    email: string;
    businessName: string | null;
    settings: {
      senderName: string;
      senderEmail: string;
      replyTo: string | null;
      ccOwner: boolean;
      signature: string;
      businessName: string;
      lateFeePolicy: string;
      sequence: string;
      catchUpOnLate: boolean;
      pauseOnReplyDays: number;
    } | null;
    subscription: { plan: string; status: string } | null;
    trialEndsAt: Date | null;
  };
}

export async function getInvoiceFull(invoiceId: string): Promise<InvoiceFull | null> {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: { select: { name: true, email: true } },
      user: {
        select: {
          id: true,
          email: true,
          businessName: true,
          trialEndsAt: true,
          settings: {
            select: {
              senderName: true,
              senderEmail: true,
              replyTo: true,
              ccOwner: true,
              signature: true,
              businessName: true,
              lateFeePolicy: true,
              sequence: true,
              catchUpOnLate: true,
              pauseOnReplyDays: true,
            },
          },
          subscription: { select: { plan: true, status: true } },
        },
      },
    },
  });
  return inv as InvoiceFull | null;
}

/**
 * (Re)builds the chase schedule for an invoice.
 *
 * Rules:
 * - Only active invoices with chasing enabled get pending emails.
 * - Steps are anchored to the invoice due date (offsetDays).
 * - Past-due invoices don't receive retroactive spam: earlier missed steps are
 *   skipped and the most recent applicable step is scheduled immediately
 *   (if catch-up is enabled), then the ladder continues normally.
 * - Editing an invoice resyncs: stale steps are cancelled/recreated.
 */
export async function syncScheduleForInvoice(invoiceId: string): Promise<void> {
  const inv = await getInvoiceFull(invoiceId);
  if (!inv) return;

  const existing = await db.scheduledEmail.findMany({ where: { invoiceId } });
  const pendingByStep = new Map(existing.filter((e) => e.status === "pending").map((e) => [e.stepIndex, e]));

  if (inv.status !== "active" || !inv.chasingEnabled) {
    if (pendingByStep.size) {
      await db.scheduledEmail.updateMany({
        where: { invoiceId, status: "pending" },
        data: { status: "cancelled", error: "invoice not active" },
      });
    }
    return;
  }

  const settings = inv.user.settings;
  const steps = sequenceFor(settings);
  const now = Date.now();

  // Determine which past step is the latest one that should fire on catch-up
  let catchupStepIdx = -1;
  if (settings?.catchUpOnLate ?? true) {
    for (let i = 0; i < steps.length; i++) {
      if (duePlus(inv.dueAt, steps[i].offsetDays).getTime() <= now) catchupStepIdx = i;
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (pendingByStep.has(i)) continue; // keep existing schedule
    const alreadySent = existing.some((e) => e.stepIndex === i && e.status === "sent");
    if (alreadySent) continue;

    const plannedFor = duePlus(inv.dueAt, step.offsetDays);
    const isPast = plannedFor.getTime() <= now;

    let effectivePlannedFor = plannedFor;
    if (isPast) {
      if (i === catchupStepIdx) {
        effectivePlannedFor = new Date(now + 5 * 60 * 1000); // catch up in 5 min
      } else {
        await db.scheduledEmail.create({
          data: {
            invoiceId,
            stepIndex: i,
            stepLabel: step.label,
            subject: "",
            body: "",
            plannedFor,
            status: "skipped",
            error: "date passed before scheduling",
          },
        });
        continue;
      }
    }

    await db.scheduledEmail.create({
      data: {
        invoiceId,
        stepIndex: i,
        stepLabel: step.label,
        subject: "",
        body: "",
        plannedFor: effectivePlannedFor,
        status: "pending",
      },
    });
  }

  // Cancel pendings whose stepIndex no longer exists in the sequence
  const validIdx = new Set(steps.map((_, i) => i));
  for (const [idx, email] of pendingByStep) {
    if (!validIdx.has(idx)) {
      await db.scheduledEmail.update({ where: { id: email.id }, data: { status: "cancelled", error: "step removed from sequence" } });
    }
  }
}

function duePlus(due: Date, offsetDays: number): Date {
  return new Date(due.getTime() + offsetDays * 24 * 60 * 60 * 1000);
}

export function buildTemplateVars(inv: InvoiceFull): { vars: TemplateVars; branding: boolean } {
  const s = inv.user.settings;
  const daysLate = Math.floor((Date.now() - inv.dueAt.getTime()) / (24 * 3600 * 1000));
  const daysEarly = daysLate < 0 ? Math.abs(daysLate) : 0;
  const firstName = inv.customer.name.split(" ")[0] || inv.customer.name;
  const businessName = s?.businessName || inv.user.businessName || "";
  const removeBranding =
    effectivePlan(
      (inv.user.subscription?.plan as never) ?? "free",
      inv.user.subscription?.status ?? "active",
      inv.user.trialEndsAt
    ).removeBranding;

  const vars: TemplateVars = {
    customer_name: firstName === inv.customer.name ? inv.customer.name : `${firstName}`,
    first_name: firstName,
    invoice_number: inv.number,
    amount: fmtMoney(inv.amountCents, inv.currency),
    due_date: fmtDate(inv.dueAt),
    days_late: Math.max(daysLate, 0),
    days_early: daysEarly,
    business_name: businessName,
    pay_link_block: inv.paymentUrl ? `You can pay online in under a minute:\n${inv.paymentUrl}` : "",
    late_fee_line:
      daysLate > 0 && s?.lateFeePolicy ? `As a reminder, our terms provide: ${s.lateFeePolicy}` : "",
    signature: s?.signature ? `\n${s.signature}` : "",
  };
  return { vars, branding: !removeBranding };
}

export interface TickResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Worker tick: sends every due chase email, enforcing plan limits.
 * Called by the internal cron loop and by POST /api/cron/tick.
 */
export async function runTick(now = new Date()): Promise<TickResult> {
  const due = await db.scheduledEmail.findMany({
    where: { status: "pending", plannedFor: { lte: now } },
    include: { invoice: { select: { id: true } } },
    orderBy: { plannedFor: "asc" },
    take: 250,
  });

  const result: TickResult = { sent: 0, failed: 0, skipped: 0 };
  const activeCountCache = new Map<string, Map<string, number>>(); // userId -> invoiceId -> rank

  for (const email of due) {
    const inv = await getInvoiceFull(email.invoiceId);
    if (!inv || inv.status !== "active" || !inv.chasingEnabled) {
      await db.scheduledEmail.update({ where: { id: email.id }, data: { status: "cancelled", error: "invoice not active at send time" } });
      result.skipped++;
      continue;
    }

    // Plan limit: rank active chased invoices by oldest overdue first
    const plan = effectivePlan(
      (inv.user.subscription?.plan as never) ?? "free",
      inv.user.subscription?.status ?? "active",
      inv.user.trialEndsAt
    );
    let ranks = activeCountCache.get(inv.userId);
    if (!ranks) {
      const actives = await db.invoice.findMany({
        where: { userId: inv.userId, status: "active", chasingEnabled: true },
        orderBy: { dueAt: "asc" },
        select: { id: true },
      });
      ranks = new Map(actives.map((a, i) => [a.id, i]));
      activeCountCache.set(inv.userId, ranks);
    }
    const rank = ranks.get(inv.id);
    if (rank === undefined || rank >= plan.maxActiveInvoices) {
      await db.scheduledEmail.update({
        where: { id: email.id },
        data: { status: "skipped", error: `plan limit reached (${plan.name}: ${plan.maxActiveInvoices} active invoices)` },
      });
      result.skipped++;
      continue;
    }

    const steps = sequenceFor(inv.user.settings);
    const step = steps[email.stepIndex] ?? steps[steps.length - 1];
    const { vars, branding } = buildTemplateVars(inv);

    // Re-render at send time so amounts/dates/days_late are current
    const subject = renderTemplate(step.subjectTemplate, vars);
    let body = renderTemplate(step.bodyTemplate, vars);
    if (branding) body += BRANDING_FOOTER;

    const res = await sendEmail({
      userId: inv.userId,
      to: inv.customer.email,
      subject,
      text: body,
      replyTo: inv.user.settings?.replyTo || undefined,
      cc: inv.user.settings?.ccOwner ? inv.user.email : undefined,
      kind: "chase",
    });

    if (res.ok) {
      await db.$transaction([
        db.scheduledEmail.update({
          where: { id: email.id },
          data: { status: "sent", sentAt: new Date(), subject, body, providerId: res.id, error: null },
        }),
        db.invoice.update({ where: { id: inv.id }, data: { lastChasedAt: new Date() } }),
        db.conversationEvent.create({
          data: { invoiceId: inv.id, type: "chase_sent", direction: "outbound", summary: `${step.label} email sent to ${inv.customer.email}`, occurredAt: new Date() },
        }),
      ]);
      result.sent++;
    } else {
      await db.scheduledEmail.update({
        where: { id: email.id },
        data: { status: "failed", subject, body, error: res.error?.slice(0, 500) },
      });
      result.failed++;
    }
  }

  if (result.sent || result.failed || result.skipped) {
    logger.info("tick:complete", { ...result });
  }
  return result;
}

/** Cancels any pending chases (used when marking paid/void/disputed). */
export async function cancelPendingForInvoice(invoiceId: string, reason: string) {
  await db.scheduledEmail.updateMany({
    where: { invoiceId, status: "pending" },
    data: { status: "cancelled", error: reason },
  });
}

/**
 * Handles an inbound customer reply: logs it, snoozes pending chases for all
 * open invoices of that customer, flags reported payments, notifies the owner.
 */
export async function handleCustomerReply(opts: {
  ownerUserId: string;
  fromEmail: string;
  subject: string;
  text: string;
}): Promise<{ handled: boolean }> {
  const customer = await db.customer.findFirst({
    where: { userId: opts.ownerUserId, email: { equals: opts.fromEmail.toLowerCase() } },
  });
  if (!customer) return { handled: false };

  const openInvoices = await db.invoice.findMany({
    where: { userId: opts.ownerUserId, customerId: customer.id, status: "active" },
  });
  const target = openInvoices[0];

  if (target) {
    await db.conversationEvent.create({
      data: {
        invoiceId: target.id,
        type: "reply_received",
        direction: "inbound",
        summary: `Reply received: "${opts.subject.slice(0, 120)}"`,
        rawText: opts.text.slice(0, 8000),
      },
    });

    const settings = await db.userSettings.findUnique({ where: { userId: opts.ownerUserId } });
    const snoozeDays = settings?.pauseOnReplyDays ?? 3;
    const snoozeMs = snoozeDays * 24 * 3600 * 1000;

    for (const inv of openInvoices) {
      const pendings = await db.scheduledEmail.findMany({ where: { invoiceId: inv.id, status: "pending" } });
      for (const p of pendings) {
        await db.scheduledEmail.update({
          where: { id: p.id },
          data: { plannedFor: new Date(Math.max(p.plannedFor.getTime(), Date.now()) + snoozeMs) },
        });
      }
    }

    const paidMention = /\b(paid|payment sent|sent the (payment|money|invoice amount)|transferred|remittance|wire confirmation)\b/i.test(opts.text);
    if (paidMention) {
      await db.conversationEvent.create({
        data: {
          invoiceId: target.id,
          type: "payment_reported",
          direction: "internal",
          summary: "Customer appears to report a payment — verify and mark invoice paid.",
        },
      });
      logEvent(opts.ownerUserId, "payment_reported", { invoiceId: target.id });
    }
  }

  const owner = await db.user.findUnique({ where: { id: opts.ownerUserId }, include: { settings: true } });
  if (owner) {
    await sendEmail({
      userId: owner.id,
      to: owner.email,
      subject: `[Paidhound] ${customer.name} replied: ${opts.subject.slice(0, 80)}`,
      text: `${customer.name} (${customer.email}) replied to a chase.\n\nSubject: ${opts.subject}\n\n---\n${opts.text.slice(0, 2000)}\n---\n\nOpen chases for this customer were snoozed ${(owner.settings?.pauseOnReplyDays ?? 3)} day(s). Review it in your dashboard.`,
      kind: "system",
    });
  }
  logEvent(opts.ownerUserId, "reply_received", { customerId: customer.id });
  return { handled: true };
}
