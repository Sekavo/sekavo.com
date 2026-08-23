import { createHash } from "crypto";
import { db } from "./db";
import { logger } from "./logger";
import { logEvent } from "./analytics";
import { sendEmail } from "./email/sender";
import { renderTemplate, sequenceFor, type TemplateVars } from "./email/templates";
import { effectivePlan } from "./plans";

const DAY_MS = 24 * 60 * 60 * 1000;
const BRANDING_FOOTER = "\n\n—\nFollowed up automatically by Sekavo.";
/** Delay before a catch-up email fires on overdue invoices — gives users a window to pause. */
export const CATCHUP_DELAY_MS = 60 * 60 * 1000;
/** Claims older than this are considered abandoned (crash recovery) and requeued. */
const STALE_CLAIM_MS = 15 * 60 * 1000;

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

/**
 * The address customers reply to when they hit "reply" on a chase email.
 * Replies land here so Sekavo can detect them; the owner is forwarded
 * the content. Returns undefined when inbound replies aren't configured.
 */
export function captureAddressFor(userId: string): string | undefined {
  const domain = process.env.INBOUND_DOMAIN;
  if (!domain) return undefined;
  return `reply+${userId}@${domain}`;
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
 *   skipped and the most recent applicable step is scheduled after a safety
 *   delay (CATCHUP_DELAY_MS), giving the user a window to review or pause.
 * - Editing an invoice resyncs: stale steps are cancelled/recreated.
 */
export async function syncScheduleForInvoice(
  invoiceId: string,
  opts?: { reanchor?: boolean }
): Promise<void> {
  const inv = await getInvoiceFull(invoiceId);
  if (!inv) return;

  const existing = await db.scheduledEmail.findMany({ where: { invoiceId } });
  const pendingByStep = new Map(existing.filter((e) => e.status === "pending").map((e) => [e.stepIndex, e]));

  if (inv.status !== "active" || !inv.chasingEnabled) {
    await cancelPendingForInvoice(invoiceId, "invoice not active");
    return;
  }

  const settings = inv.user.settings;
  const steps = sequenceFor(settings);
  const now = Date.now();
  const reanchor = opts?.reanchor ?? false;

  // Catch-up tone selection: match the customer's actual lateness, not the
  // most severe template. A 9-day-late invoice gets the +7 nudge as its first
  // contact — never a final notice out of nowhere.
  const daysLateFloor = Math.floor((now - inv.dueAt.getTime()) / DAY_MS);
  let catchupStepIdx = -1;
  if (settings?.catchUpOnLate ?? true) {
    let bestByLateness = -1;
    for (let i = 0; i < steps.length; i++) {
      const anchorPast = duePlus(inv.dueAt, steps[i].offsetDays).getTime() <= now;
      if (!anchorPast) continue;
      if (steps[i].offsetDays <= daysLateFloor && i > bestByLateness) bestByLateness = i;
    }
    catchupStepIdx = bestByLateness >= 0 ? bestByLateness : (() => {
      let latest = -1;
      for (let i = 0; i < steps.length; i++) {
        if (duePlus(inv.dueAt, steps[i].offsetDays).getTime() <= now) latest = i;
      }
      return latest;
    })();
  }

  /** The date step `i` should fire on, given the current due date. */
  const desiredFor = (i: number): { date: Date; skipped: boolean } => {
    const plannedFor = duePlus(inv.dueAt, steps[i].offsetDays);
    if (plannedFor.getTime() <= now) {
      if (i === catchupStepIdx && !existing.some((e) => e.stepIndex === i && e.status === "sent")) {
        return { date: new Date(now + CATCHUP_DELAY_MS), skipped: false };
      }
      return { date: plannedFor, skipped: true };
    }
    return { date: plannedFor, skipped: false };
  };

  // Re-anchoring (due-date edit): move every queued step to its newly correct
  // slot — past slots are cancelled as superseded so nothing retro-fires.
  if (reanchor) {
    for (const [idx, email] of pendingByStep) {
      if (!steps[idx]) continue;
      const want = desiredFor(idx);
      if (want.skipped) {
        await db.scheduledEmail.update({
          where: { id: email.id },
          data: { status: "cancelled", error: "due date changed — step no longer applicable" },
        });
        pendingByStep.delete(idx);
      } else if (email.plannedFor.getTime() !== want.date.getTime()) {
        await db.scheduledEmail.update({ where: { id: email.id }, data: { plannedFor: want.date } });
      }
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (pendingByStep.has(i)) continue; // keep existing schedule
    const alreadySent = existing.some((e) => e.stepIndex === i && e.status === "sent");
    if (alreadySent) continue;

    const desired = desiredFor(i);

    if (desired.skipped) {
      await db.scheduledEmail.create({
        data: {
          invoiceId,
          stepIndex: i,
          stepLabel: step.label,
          subject: "",
          body: "",
          plannedFor: desired.date,
          status: "skipped",
          error: "date passed before scheduling",
        },
      });
      continue;
    }

    await db.scheduledEmail.create({
      data: {
        invoiceId,
        stepIndex: i,
        stepLabel: step.label,
        subject: "",
        body: "",
        plannedFor: desired.date,
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

export function renderClean(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // collapse gaps left by empty optional blocks
    .trimEnd();
}

export function buildTemplateVars(inv: InvoiceFull): { vars: TemplateVars; branding: boolean } {
  const s = inv.user.settings;
  const daysLate = Math.floor((Date.now() - inv.dueAt.getTime()) / (24 * 3600 * 1000));
  const daysEarly = daysLate < 0 ? Math.abs(daysLate) : 0;
  const fullName = inv.customer.name.trim();
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const businessName = s?.businessName || inv.user.businessName || "";
  const removeBranding =
    effectivePlan(
      (inv.user.subscription?.plan as never) ?? "free",
      inv.user.subscription?.status ?? "active",
      inv.user.trialEndsAt
    ).removeBranding;

  const vars: TemplateVars = {
    customer_name: fullName,
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
  requeued: number;
}

/**
 * Worker tick: sends every due chase email, enforcing plan limits.
 *
 * Delivery is exactly-once-per-attempt via atomic row claims:
 * a pending row is transitioned to `sending` with a conditional update that
 * only succeeds for one caller; concurrent ticks see claimCount=0 and move on.
 * Rows stuck in `sending` beyond STALE_CLAIM_MS (crash mid-send) are requeued
 * at most once per tick by the same conditional-update mechanism.
 */
export async function runTick(now = new Date()): Promise<TickResult> {
  // Crash recovery: requeue claims that went stale
  const staleCutoff = new Date(now.getTime() - STALE_CLAIM_MS);
  const requeued = await db.scheduledEmail.updateMany({
    where: { status: "sending", updatedAt: { lt: staleCutoff } },
    data: { status: "pending", error: "requeued after stalled send" },
  });

  const due = await db.scheduledEmail.findMany({
    where: { status: "pending", plannedFor: { lte: now } },
    orderBy: { plannedFor: "asc" },
    take: 250,
  });

  const result: TickResult = { sent: 0, failed: 0, skipped: 0, requeued: requeued.count };
  const activeCountCache = new Map<string, Map<string, number>>(); // userId -> invoiceId -> rank

  // Burst protection: if multiple steps of one invoice are due simultaneously
  // (worker downtime, bulk import), send only the most advanced step and mark
  // the rest superseded. A customer must never receive a pile-up of chases.
  const dueByInvoice = new Map<string, typeof due>();
  for (const e of due) {
    const list = dueByInvoice.get(e.invoiceId);
    if (list) list.push(e);
    else dueByInvoice.set(e.invoiceId, [e]);
  }
  const survivors = new Set<string>();
  for (const list of dueByInvoice.values()) {
    let maxIdx = -Infinity;
    let maxId = "";
    for (const e of list) {
      if (e.stepIndex > maxIdx) {
        maxIdx = e.stepIndex;
        maxId = e.id;
      }
    }
    survivors.add(maxId);
  }

  for (const email of due) {
    // Atomic claim: only one concurrent tick can flip pending → sending
    const claimed = await db.scheduledEmail.updateMany({
      where: { id: email.id, status: "pending" },
      data: { status: "sending" },
    });
    if (claimed.count !== 1) continue; // someone else took it

    const finish = async (data: { status: string; error?: string | null }) =>
      db.scheduledEmail.updateMany({
        where: { id: email.id, status: "sending" },
        data: { status: data.status, error: data.error ?? null },
      });

    if (!survivors.has(email.id)) {
      await finish({ status: "skipped", error: "superseded by a later step due at the same time" });
      result.skipped++;
      continue;
    }

    const inv = await getInvoiceFull(email.invoiceId);
    if (!inv || inv.status !== "active" || !inv.chasingEnabled) {
      await finish({ status: "cancelled", error: "invoice not active at send time" });
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
      await finish({ status: "skipped", error: `plan limit reached (${plan.name}: ${plan.maxActiveInvoices} active invoices)` });
      result.skipped++;
      continue;
    }

    const steps = sequenceFor(inv.user.settings);
    const step = steps[email.stepIndex] ?? steps[steps.length - 1];
    const { vars, branding } = buildTemplateVars(inv);

    // Re-render at send time so amounts/dates/days_late are current
    const subject = renderClean(renderTemplate(step.subjectTemplate, vars));
    let body = renderClean(renderTemplate(step.bodyTemplate, vars));
    if (branding) body += BRANDING_FOOTER;

    const res = await sendEmail({
      userId: inv.userId,
      to: inv.customer.email,
      subject,
      text: body,
      replyTo: captureAddressFor(inv.userId) ?? inv.user.settings?.replyTo ?? undefined,
      cc: inv.user.settings?.ccOwner ? inv.user.email : undefined,
      kind: "chase",
    });

    if (res.ok) {
      await db.$transaction([
        db.scheduledEmail.updateMany({
          where: { id: email.id, status: "sending" },
          data: { status: "sent", sentAt: new Date(), subject, body, providerId: res.id, error: null },
        }),
        db.invoice.update({ where: { id: inv.id }, data: { lastChasedAt: new Date() } }),
        db.conversationEvent.create({
          data: { invoiceId: inv.id, type: "chase_sent", direction: "outbound", summary: `${step.label} email sent to ${inv.customer.email}`, occurredAt: new Date() },
        }),
      ]);
      result.sent++;
    } else {
      await finish({ status: "failed", error: res.error?.slice(0, 500) });
      // persist rendered copy for debugging
      await db.scheduledEmail.update({ where: { id: email.id }, data: { subject, body } }).catch(() => {});
      result.failed++;
    }
  }

  if (result.sent || result.failed || result.skipped || result.requeued) {
    logger.info("tick:complete", { ...result });
  }
  return result;
}

/** Cancels any queued chases (used when marking paid/void/disputed/deleted). */
export async function cancelPendingForInvoice(invoiceId: string, reason: string) {
  await db.scheduledEmail.updateMany({
    where: { invoiceId, status: { in: ["pending", "sending"] }, sentAt: null },
    data: { status: "cancelled", error: reason },
  });
}

/** Stable dedup key for inbound reply processing. */
export function replyDedupKey(ownerUserId: string, fromEmail: string, subject: string, text: string): string {
  return createHash("sha256").update(`${ownerUserId}|${fromEmail.toLowerCase()}|${subject.trim()}|${text.trim().slice(0, 2000)}`).digest("hex");
}

/**
 * Handles an inbound customer reply: logs it (idempotently), snoozes pending
 * chases for all open invoices of that customer, flags reported payments,
 * notifies the owner. Duplicate provider deliveries are ignored via dedupKey.
 */
export async function handleCustomerReply(opts: {
  ownerUserId: string;
  fromEmail: string;
  subject: string;
  text: string;
}): Promise<{ handled: boolean; duplicate?: boolean }> {
  const dedupKey = replyDedupKey(opts.ownerUserId, opts.fromEmail, opts.subject, opts.text);

  // Idempotency gate: identical deliveries within retention are no-ops
  try {
    const dupe = await db.conversationEvent.findFirst({ where: { dedupKey } });
    if (dupe) {
      logger.info("inbound:duplicate_ignored", { userId: opts.ownerUserId });
      return { handled: true, duplicate: true };
    }
  } catch (err) {
    logger.warn("inbound:dedup_check_failed", { err: String(err) }); // fail open to processing
  }

  const customer = await db.customer.findFirst({
    where: { userId: opts.ownerUserId, email: { equals: opts.fromEmail.toLowerCase() } },
  });
  if (!customer) return { handled: false };

  const openInvoices = await db.invoice.findMany({
    where: { userId: opts.ownerUserId, customerId: customer.id, status: "active" },
    orderBy: { dueAt: "asc" },
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
        dedupKey,
      },
    });

    const settings = await db.userSettings.findUnique({ where: { userId: opts.ownerUserId } });
    const snoozeDays = settings?.pauseOnReplyDays ?? 3;
    const snoozeHorizon = new Date(Date.now() + snoozeDays * 24 * 3600 * 1000);

    // No queued step for this customer may fire before the snooze horizon.
    // Steps already scheduled further out keep their dates.
    await db.scheduledEmail.updateMany({
      where: {
        invoiceId: { in: openInvoices.map((i) => i.id) },
        status: "pending",
        sentAt: null,
        plannedFor: { lt: snoozeHorizon },
      },
      data: { plannedFor: snoozeHorizon },
    });

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
      subject: `[Sekavo] ${customer.name} replied: ${opts.subject.slice(0, 80)}`,
      text: `${customer.name} (${customer.email}) replied to a chase.\n\nSubject: ${opts.subject}\n\n---\n${opts.text.slice(0, 2000)}\n---\n\nOpen chases for this customer were snoozed ${(owner.settings?.pauseOnReplyDays ?? 3)} day(s). Review it in your dashboard.`,
      kind: "system",
    });
  }
  logEvent(opts.ownerUserId, "reply_received", { customerId: customer.id });
  return { handled: true };
}
