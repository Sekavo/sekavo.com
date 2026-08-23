import { db } from "./db";
import { runTick, type TickResult } from "./engine";
import { sendEmail } from "./email/sender";
import { logger } from "./logger";

const g = globalThis as unknown as { __sekavoRunning?: boolean };

/** Single-flight worker loop; safe to call from cron and API simultaneously. */
export async function runWorkerLoop(): Promise<{ ok: true; tick: TickResult; digest: boolean }> {
  if (g.__sekavoRunning) {
    logger.warn("worker:already_running");
    return { ok: true, tick: { sent: 0, failed: 0, skipped: 0, requeued: 0 }, digest: false };
  }
  g.__sekavoRunning = true;
  try {
    const tick = await runTick();
    const digest = await maybeSendDailyDigest();
    return { ok: true, tick, digest };
  } finally {
    g.__sekavoRunning = false;
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

    const [sentToday, repliesToday, activeInvoices, overdueInvoices] = await Promise.all([
      db.scheduledEmail.count({ where: { status: "sent", sentAt: { gte: startOfDay }, invoice: { userId: user.id } } }),
      db.conversationEvent.count({
        where: { type: "reply_received", occurredAt: { gte: startOfDay }, invoice: { userId: user.id } },
      }),
      db.invoice.count({ where: { userId: user.id, status: "active" } }),
      db.invoice.findMany({
        where: { userId: user.id, status: "active", dueAt: { lt: new Date() } },
        select: { amountCents: true, currency: true },
      }),
    ]);

    if (sentToday === 0 && repliesToday === 0) continue; // nothing to report

    // Sum overdue per currency — never mix symbols across currencies
    const byCurrency = new Map<string, number>();
    for (const inv of overdueInvoices) {
      byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + inv.amountCents);
    }
    const overdueLine =
      byCurrency.size === 0
        ? "none"
        : [...byCurrency.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cur, cents]) => `${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${cur}`)
            .join(" + ");

    await sendEmail({
      userId: user.id,
      to: user.email,
      subject: `[Sekavo] Daily chase report — ${sentToday} sent, ${repliesToday} repl${repliesToday === 1 ? "y" : "ies"}`,
      text: `Here's what Sekavo did in the last 24 hours:\n\n- Chase emails sent: ${sentToday}\n- Customer replies received: ${repliesToday}\n- Active invoices being chased: ${activeInvoices}\n- Overdue balance outstanding: ${overdueLine}\n\nOpen your dashboard to review replies and mark paid invoices.`,
      kind: "digest",
    });
    await db.analyticsEvent.create({ data: { userId: user.id, type: "digest_sent", meta: JSON.stringify({ sentToday, repliesToday }) } });
  }
  return true;
}
