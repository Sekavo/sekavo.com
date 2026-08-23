/**
 * Seeds a demo account with realistic data so the product can be evaluated
 * immediately: `npm run db:seed`
 * Credentials: demo@paidhound.com / demopass123
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SEQUENCE } from "../src/lib/email/templates";

const db = new PrismaClient();

const day = 24 * 3600 * 1000;
function daysFromNow(n: number) {
  return new Date(Date.now() + n * day);
}

async function main() {
  const email = "demo@paidhound.com";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo account already exists — skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("demopass123", 10);
  const user = await db.user.create({
    data: {
      email,
      name: "Maya Chen",
      businessName: "Acme Design Studio",
      passwordHash,
      trialEndsAt: daysFromNow(14),
      settings: {
        create: {
          senderName: "Maya Chen",
          senderEmail: email,
          businessName: "Acme Design Studio",
          signature: "— Maya\nAcme Design Studio\nacmedesign.studio",
          lateFeePolicy: "a 1.5% monthly late fee applies to balances more than 30 days past due",
          defaultPaymentUrl: "https://buy.stripe.com/demo_acme_studio",
          sequence: JSON.stringify(DEFAULT_SEQUENCE),
        },
      },
      subscription: { create: { plan: "free", status: "trialing" } },
    },
  });

  const customersData = [
    { name: "BigCo Inc", email: "ap@bigco.example" },
    { name: "Northwind Retail", email: "accounts@northwind.example" },
    { name: "Lumen Agency", email: "billing@lumenagency.example" },
    { name: "Harbor Legal", email: "office@harborlegal.example" },
    { name: "Solo Coffee Co", email: "owner@solocoffee.example" },
  ];

  const customers: Record<string, string> = {};
  for (const c of customersData) {
    const row = await db.customer.create({
      data: { userId: user.id, name: c.name, email: c.email },
    });
    customers[c.name] = row.id;
  }

  const invoicesData: Array<{
    customer: string;
    number: string;
    amountCents: number;
    issuedDaysAgo: number;
    dueInDays: number;
    status?: string;
    paidAfterDays?: number;
    paymentUrl?: string;
  }> = [
    { customer: "BigCo Inc", number: "INV-1038", amountCents: 385000, issuedDaysAgo: 75, dueInDays: -45, paymentUrl: "https://buy.stripe.com/demo_1038" },
    { customer: "Northwind Retail", number: "INV-1041", amountCents: 120000, issuedDaysAgo: 40, dueInDays: -10 },
    { customer: "Lumen Agency", number: "INV-1042", amountCents: 385000, issuedDaysAgo: 28, dueInDays: -2, paymentUrl: "https://buy.stripe.com/demo_1042" },
    { customer: "Harbor Legal", number: "INV-1043", amountCents: 240000, issuedDaysAgo: 14, dueInDays: 0 },
    { customer: "Solo Coffee Co", number: "INV-1044", amountCents: 96000, issuedDaysAgo: 7, dueInDays: 8, paymentUrl: "https://buy.stripe.com/demo_1044" },
    { customer: "BigCo Inc", number: "INV-1045", amountCents: 520000, issuedDaysAgo: 3, dueInDays: 26 },
    { customer: "Northwind Retail", number: "INV-1035", amountCents: 150000, issuedDaysAgo: 70, dueInDays: -40, status: "paid", paidAfterDays: 35 },
    { customer: "Lumen Agency", number: "INV-1029", amountCents: 220000, issuedDaysAgo: 90, dueInDays: -60, status: "paid", paidAfterDays: 52 },
  ];

  for (const inv of invoicesData) {
    await db.invoice.create({
      data: {
        userId: user.id,
        customerId: customers[inv.customer],
        number: inv.number,
        amountCents: inv.amountCents,
        issuedAt: daysFromNow(-inv.issuedDaysAgo),
        dueAt: daysFromNow(inv.dueInDays),
        status: inv.status ?? "active",
        paidAt: inv.paidAfterDays !== undefined ? new Date(daysFromNow(inv.dueInDays).getTime() + inv.paidAfterDays * day) : null,
        paymentUrl: inv.paymentUrl ?? null,
      },
    });
  }

  // Sync chase schedules for active invoices
  const { syncScheduleForInvoice } = await import("../src/lib/engine");
  const actives = await db.invoice.findMany({ where: { userId: user.id, status: "active" } });
  for (const inv of actives) {
    await syncScheduleForInvoice(inv.id);
  }

  // Realistic activity history
  const inv1041 = await db.invoice.findFirst({ where: { userId: user.id, number: "INV-1041" } });
  const inv1038 = await db.invoice.findFirst({ where: { userId: user.id, number: "INV-1038" } });
  const inv1042 = await db.invoice.findFirst({ where: { userId: user.id, number: "INV-1042" } });

  if (inv1041 && inv1038 && inv1042) {
    await db.conversationEvent.createMany({
      data: [
        {
          invoiceId: inv1038.id,
          type: "chase_sent",
          direction: "outbound",
          summary: "Firm follow-up email sent to ap@bigco.example",
          occurredAt: daysFromNow(-9),
        },
        {
          invoiceId: inv1038.id,
          type: "chase_sent",
          direction: "outbound",
          summary: "Final notice email sent to ap@bigco.example",
          occurredAt: daysFromNow(-2),
        },
        {
          invoiceId: inv1041.id,
          type: "chase_sent",
          direction: "outbound",
          summary: "Gentle nudge email sent to accounts@northwind.example",
          occurredAt: daysFromNow(-4),
        },
        {
          invoiceId: inv1041.id,
          type: "reply_received",
          direction: "inbound",
          summary: 'Reply received: "Re: INV-1041"',
          rawText: "Hi Maya, accounts payable is processing this week's batch — expect payment by Friday.",
          occurredAt: daysFromNow(-3),
        },
        {
          invoiceId: inv1042.id,
          type: "chase_sent",
          direction: "outbound",
          summary: "Due-today note sent to billing@lumenagency.example",
          occurredAt: daysFromNow(-2),
        },
        {
          invoiceId: inv1042.id,
          type: "manual_note",
          direction: "internal",
          summary: "PO approved by Lumen finance — expects payment this week.",
          occurredAt: daysFromNow(-1),
        },
      ],
    });

    // Mark the two older chases as actually-sent rows so timelines look lived-in
    await db.scheduledEmail.updateMany({
      where: { invoiceId: inv1038.id, status: "pending" },
      data: { status: "sent", sentAt: daysFromNow(-2), subject: "Final reminder: invoice INV-1038 — $3,850.00 overdue" },
    });
  }

  console.log("Seeded demo account:");
  console.log("  email:    demo@paidhound.com");
  console.log("  password: demopass123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
