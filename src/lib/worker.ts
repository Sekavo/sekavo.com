import { db } from "./db";
import { runTick, type TickResult } from "./engine";
import { sendEmail } from "./email/sender";
import { logger } from "./logger";

const g = globalThis as unknown as { __paidhoundRunning?: boolean };

/** Single-flight worker loop; safe to call from cron and API simultaneously. */
export async function runWorkerLoop(): Promise<{ ok: true; tick: TickResult; digest: boolean }> {
  if (g.__paidhoundRunning) {
    logger.warn("worker:already_running");
    return { ok: true, tick: { sent: 0, failed: 0, skipped: 0, requeued: 0 }, digest: false };
  }
  g.__paidhoundRunning = true;
  try {
    const tick = await runTick();
    const digest = await maybeSendDailyDigest();
    return { ok: true, tick, digest };
  } finally {
    g.__paidhoundRunning = false;
  }
}

/** One owner digest per day summarizing chases, replies, and cash at risk. */
async function maybeSendDailyDigest(): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const users = await db.user.findMany({
    where: {
      settings: { onboardingDone: true },
      invoices: { some: { status: "active" } },
    },
    select: { id: true, email: true, businessName: true },
  });

  for (const user of users) {
    const alreadySent = await db.analyticsEvent.findFirst({
      where: { userId: user.id, type: "digest_sent", createdAt: { gte: startOfDay } },
    });
    if (alreadySent) continue;

    const [sentToday, repliesToday, activeInvoices, overdueSum] = await Promise.all([
      db.scheduledEmail.count({ where: { status: "sent", sentAt: { gte: startOfDay }, invoice: { userId: user.id } } }),
      db.conversationEvent.count({
        where: { type: "reply_received", occurredAt: { gte: startOfDay }, invoice: { userId: user.id } },
      }),
      db.invoice.count({ where: { userId: user.id, status: "active" } }),
      db.invoice.aggregate({
        where: { userId: user.id, status: "active", dueAt: { lt: new Date() } },
        _sum: { amountCents: true },
      }),
    ]);

    if (sentToday === 0 && repliesToday === 0) continue; // nothing to report

    const overdue = overdueSum._sum.amountCents ?? 0;
    await sendEmail({
      userId: user.id,
      to: user.email,
      subject: `[Paidhound] Daily chase report — ${sentToday} sent, ${repliesToday} repl${repliesToday === 1 ? "y" : "ies"}`,
      text: `Here's what Paidhound did in the last 24 hours:\n\n- Chase emails sent: ${sentToday}\n- Customer replies received: ${repliesToday}\n- Active invoices being chased: ${activeInvoices}\n- Overdue balance outstanding: $${(overdue / 100).toFixed(2)}\n\nOpen your dashboard to review replies and mark paid invoices.`,
      kind: "digest",
    });
    await db.analyticsEvent.create({ data: { userId: user.id, type: "digest_sent", meta: JSON.stringify({ sentToday, repliesToday }) } });
  }
  return true;
}
