/**
 * Scenario/integration tests exercising the engine directly against a
 * throwaway SQLite database. Run: npx tsx scripts/scenario.test.ts
 */
process.env.DATABASE_URL = "file:./scenario.db";

import { PrismaClient } from "@prisma/client";
import { runTick, syncScheduleForInvoice, cancelPendingForInvoice, handleCustomerReply } from "../src/lib/engine";
import { DEFAULT_SEQUENCE } from "../src/lib/email/templates";

const db = new PrismaClient();
let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.log(`✗ ${name} ${detail}`);
  }
}
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (d: number) => new Date(Date.now() + d * DAY);

let counter = 0;
async function makeTenant(opts?: { plan?: string; status?: string; trialEndsAt?: Date | null }) {
  counter++;
  return db.user.create({
    data: {
      email: `t${counter}-${Date.now()}@scenario.test`,
      name: "T",
      passwordHash: "x",
      trialEndsAt: opts?.trialEndsAt === undefined ? ahead(14) : opts.trialEndsAt,
      settings: {
        create: {
          senderName: "T", senderEmail: `t${counter}@x.test`, businessName: "Biz",
          sequence: JSON.stringify(DEFAULT_SEQUENCE), catchUpOnLate: true,
        },
      },
      subscription: { create: { plan: opts?.plan ?? "free", status: opts?.status ?? "trialing" } },
    },
  });
}

async function addInvoice(userId: string, o: { dueDays: number; number?: string; email?: string; name?: string; paymentUrl?: string }) {
  const customer = await db.customer.upsert({
    where: { userId_email: { userId, email: o.email ?? `c-${userId}@x.test` } },
    create: { userId, email: o.email ?? `c-${userId}@x.test`, name: o.name ?? "Client" },
    update: {},
  });
  const inv = await db.invoice.create({
    data: {
      userId, customerId: customer.id,
      number: o.number ?? `INV-${Math.random().toString(36).slice(2, 8)}`,
      amountCents: 10000, currency: "USD",
      issuedAt: ago(40), dueAt: o.dueDays >= 0 ? ahead(o.dueDays) : ago(-o.dueDays),
      paymentUrl: o.paymentUrl, status: "active",
    },
  });
  await syncScheduleForInvoice(inv.id);
  return inv;
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { contains: "@scenario.test" } } });
}
async function main() {
  await cleanup();

  // ---- 1. Overdue invoice: catch-up delay + step skipping ----
  {
    const u = await makeTenant();
    const inv = await addInvoice(u.id, { dueDays: -7 });
    const rows = await db.scheduledEmail.findMany({ where: { invoiceId: inv.id }, orderBy: { stepIndex: "asc" } });
    const pending = rows.filter((r) => r.status === "pending");
    const skipped = rows.filter((r) => r.status === "skipped");
    // -7d overdue → steps -3 and 0 in the past; +7 due now; +14/+21 future
    check("overdue: past steps skipped, not deleted", skipped.length === 2, `skipped=${skipped.length}`);
    check("overdue: remaining ladder scheduled (now + future steps)", pending.length === 3, `pending=${pending.length}`);
    check("overdue: earliest send is the ~60min catch-up, not instant",
      pending[0].plannedFor.getTime() > Date.now() + 30 * 60 * 1000);
    check("overdue: catch-up is the most recent applicable step (+7)",
      pending[0]?.stepLabel.toLowerCase().includes("nudge"), pending[0]?.stepLabel);
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 2. Very old invoice → final notice only ----
  {
    const u = await makeTenant();
    const inv = await addInvoice(u.id, { dueDays: -45 });
    const pending = await db.scheduledEmail.findMany({ where: { invoiceId: inv.id, status: "pending" } });
    check("45-day-old invoice: single final-notice catch-up",
      pending.length === 1 && pending[0].stepLabel.toLowerCase().includes("final"), pending[0]?.stepLabel);
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 3. Concurrent ticks: atomic claiming prevents double-send ----
  {
    const u = await makeTenant(); // trialing → pro caps
    await addInvoice(u.id, { dueDays: -10 });
    // force ALL steps into the past (simulates worker downtime) — burst protection
    // must coalesce them into a single email even under concurrent ticks
    await db.scheduledEmail.updateMany({ where: { invoice: { userId: u.id }, status: "pending" }, data: { plannedFor: new Date(Date.now() - 1000) } });
    const results = await Promise.all(Array.from({ length: 5 }, () => runTick()));
    const sentTotal = results.reduce((s, r) => s + r.sent, 0);
    const stuck = await db.scheduledEmail.count({ where: { invoice: { userId: u.id }, status: "sending" } });
    check("5 concurrent ticks after downtime → exactly 1 email", sentTotal === 1, `sent=${sentTotal}`);
    check("no rows left stuck in sending", stuck === 0);
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 4. Payment immediately before chase → nothing sent ----
  {
    const u = await makeTenant();
    const inv = await addInvoice(u.id, { dueDays: -3 });
    await db.scheduledEmail.updateMany({ where: { invoiceId: inv.id }, data: { plannedFor: new Date(Date.now() - 1000) } });
    await db.invoice.update({ where: { id: inv.id }, data: { status: "paid", paidAt: new Date() } });
    await cancelPendingForInvoice(inv.id, "invoice marked paid");
    const r = await runTick();
    const sentToCustomer = await db.outboundEmailLog.count({ where: { userId: u.id, kind: "chase" } });
    check("paid-before-chase → zero chase emails", r.sent === 0 && sentToCustomer === 0, `sent=${r.sent} logs=${sentToCustomer}`);
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 5. Reply immediately before chase → snoozed past horizon ----
  {
    const u = await makeTenant();
    const inv = await addInvoice(u.id, { dueDays: -2, email: "replyrace@x.test", name: "Racer" });
    await db.scheduledEmail.updateMany({ where: { invoiceId: inv.id }, data: { plannedFor: new Date(Date.now() - 1000) } });
    await handleCustomerReply({ ownerUserId: u.id, fromEmail: "replyrace@x.test", subject: "Re: soon", text: "on friday!" });
    const pendings = await db.scheduledEmail.findMany({ where: { invoiceId: inv.id, status: "pending" } });
    check("reply snoozes queued steps ≥3 days out",
      pendings.every((p) => p.plannedFor.getTime() > Date.now() + 2.9 * DAY));
    const r = await runTick();
    check("tick does not send during snooze", r.sent === 0);
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 6. Same customer, two invoices → both snoozed; dedup on identical delivery ----
  {
    const u = await makeTenant();
    await addInvoice(u.id, { dueDays: -5, number: "A-1", email: "multi@x.test" });
    await addInvoice(u.id, { dueDays: 10, number: "A-2", email: "multi@x.test" });
    const payload = { ownerUserId: u.id, fromEmail: "multi@x.test", subject: "Re: invoices", text: "sending both this week" };
    const r1 = await handleCustomerReply(payload);
    const r2 = await handleCustomerReply(payload);
    const r3 = await handleCustomerReply(payload);
    check("first delivery handled", r1.handled && !r1.duplicate);
    check("duplicate deliveries are idempotent", r2.duplicate === true && r3.duplicate === true);
    const events = await db.conversationEvent.findMany({
      where: { type: "reply_received", invoice: { userId: u.id } },
    });
    check("exactly one reply event recorded", events.length === 1, `count=${events.length}`);
    const pendings = await db.scheduledEmail.findMany({
      where: { status: "pending", invoice: { userId: u.id, customer: { email: "multi@x.test" } } },
    });
    check("both invoices of customer snoozed", pendings.length >= 2 && pendings.every((p) => p.plannedFor.getTime() > Date.now() + 2.9 * DAY));
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 7. Tenant isolation on replies ----
  {
    const a = await makeTenant();
    const b = await makeTenant();
    await addInvoice(a.id, { dueDays: -1, email: "shared@x.test" });
    await addInvoice(b.id, { dueDays: -1, email: "b-own@x.test", name: "BTenant" });
    // Tenant B receives its own customer reply; tenant A must be untouched
    await handleCustomerReply({ ownerUserId: b.id, fromEmail: "b-own@x.test", subject: "x", text: "hi from B's customer" });
    const eventsA = await db.conversationEvent.count({ where: { invoice: { userId: a.id } } });
    const eventsB = await db.conversationEvent.count({ where: { invoice: { userId: b.id } } });
    check("tenant A untouched by tenant B reply", eventsA === 0, `eventsA=${eventsA}`);
    check("tenant B processed own reply only", eventsB >= 1, `eventsB=${eventsB}`);
    await db.user.delete({ where: { id: a.id } });
    await db.user.delete({ where: { id: b.id } });
  }

  // ---- 8. Expired trial downgrades caps (free=3) with existing invoices above limit ----
  {
    const u = await makeTenant({ plan: "free", status: "active", trialEndsAt: null }); // expired/free
    // 5 active invoices, all overdue, all due for immediate chase
    for (let i = 0; i < 5; i++) {
      const inv = await addInvoice(u.id, { dueDays: -(i + 1), number: `CAP-${i}`, email: `cap${i}@x.test` });
      await db.scheduledEmail.updateMany({ where: { invoiceId: inv.id }, data: { plannedFor: new Date(Date.now() - 1000) } });
    }
    const r = await runTick();
    const logs = await db.outboundEmailLog.count({ where: { userId: u.id, kind: "chase", status: "sent" } });
    check("free cap enforced at send time (3 sends max)", r.sent <= 3 && logs <= 3, `sent=${r.sent} logs=${logs}`);
    const skips = await db.scheduledEmail.findMany({ where: { status: "skipped", error: { contains: "plan limit" } } });
    check("overflow marked skipped with reason", skips.length >= 2, `skips=${skips.length}`);
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 9. Canceled subscription loses paid features (regression) ----
  {
    // covered at unit level; here verify engine honors it end-to-end:
    const u = await makeTenant({ plan: "pro", status: "canceled", trialEndsAt: null });
    const invs = [];
    for (let i = 0; i < 4; i++) invs.push(await addInvoice(u.id, { dueDays: -(i + 1), number: `CX-${i}`, email: `cx${i}@x.test` }));
    await db.scheduledEmail.updateMany({ where: { invoice: { userId: u.id } }, data: { plannedFor: new Date(Date.now() - 1000) } });
    await runTick();
    const logs = await db.outboundEmailLog.count({ where: { userId: u.id, kind: "chase", status: "sent" } });
    check("canceled pro → free cap applies (≤3)", logs <= 3, `logs=${logs}`);
    const brandingLeak = await db.outboundEmailLog.findFirst({ where: { userId: u.id, kind: "chase" } });
    check("free branding footer present after downgrade", !!brandingLeak?.bodyText.includes("Paidhound"));
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 10. Crash mid-send: stale 'sending' claims are requeued exactly once ----
  {
    const u = await makeTenant();
    const inv = await addInvoice(u.id, { dueDays: -1 });
    await db.scheduledEmail.updateMany({
      where: { invoiceId: inv.id },
      data: { plannedFor: new Date(Date.now() - 1000) },
    });
    // Simulate a crashed claim from 20 minutes ago
    await db.scheduledEmail.updateMany({
      where: { invoiceId: inv.id, status: "pending" },
      data: { status: "sending", updatedAt: new Date(Date.now() - 20 * 60_000) },
    });
    const r = await runTick();
    const states = await db.scheduledEmail.findMany({ where: { invoiceId: inv.id } });
    const sentOrPending = states.filter((s) => s.status === "sent" || s.status === "pending");
    check("stale claim requeued then delivered", r.requeued >= 1 && sentOrPending.length >= 1);
    check("nothing left sending after recovery", !states.some((s) => s.status === "sending"));
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 11. Future-due invoices never send early (timezone-safe arithmetic) ----
  {
    const u = await makeTenant();
    await addInvoice(u.id, { dueDays: 30 });
    await addInvoice(u.id, { dueDays: 1, number: "TZ-2", email: "tz2@x.test" });
    const r = await runTick();
    check("future invoices: no sends", r.sent === 0);
    // DST-spanning offset math (US DST ends Nov 1 2026): pure-ms offsets stay exact
    const due = new Date("2026-10-30T12:00:00Z");
    const plus21 = new Date(due.getTime() + 21 * DAY);
    check("DST-spanning +21d lands Nov 20 UTC", plus21.toISOString().startsWith("2026-11-20"));
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- 12. Failed delivery path (invalid provider key → marked failed, not lost silently) ----
  {
    const u = await makeTenant();
    await addInvoice(u.id, { dueDays: -1, email: "failpath@x.test" });
    // Run in a subprocess so RESEND_API_KEY is set before the sender module loads
    const { execSync } = await import("child_process");
    let out = "";
    try {
      out = execSync(`npx tsx scripts/failpath.worker.ts`, { cwd: process.cwd(), encoding: "utf8", timeout: 120_000 });
    } catch (err: unknown) {
      const e = err as { stdout?: string };
      out = e.stdout ?? String(err);
    }
    const m = out.match(/PROBE failedRows=(\d+) failLogs=(\d+)/);
    check("provider failure → row marked failed + logged", !!m && Number(m[1]) >= 1 && Number(m[2]) >= 1, out.slice(-200));
    await db.user.deleteMany({ where: { email: { contains: "@scenario.test" } } }); // worker already cleaned up
  }

  await cleanup();
  console.log(`\nScenarios: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
