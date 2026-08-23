import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invoiceCreateSchema } from "@/lib/validation";
import { syncScheduleForInvoice } from "@/lib/engine";
import { logEvent } from "@/lib/analytics";
import { effectivePlan } from "@/lib/plans";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await db.invoice.findMany({
    where: { userId: user.id },
    include: {
      customer: true,
      scheduledEmails: { where: { status: "pending" }, orderBy: { plannedFor: "asc" }, take: 1 },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const d = parsed.data;
  if (new Date(d.dueAt) < new Date(d.issuedAt)) {
    return NextResponse.json({ error: "Due date cannot be before issue date." }, { status: 400 });
  }

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const activeCount = await db.invoice.count({ where: { userId: user.id, status: "active" } });
  if (activeCount >= plan.maxActiveInvoices) {
    return NextResponse.json(
      { error: `Your ${plan.name} plan allows ${plan.maxActiveInvoices} active invoices. Upgrade to chase more.`, upgradeRequired: true },
      { status: 402 }
    );
  }

  try {
    const customer = await db.customer.upsert({
      where: { userId_email: { userId: user.id, email: d.customerEmail.toLowerCase() } },
      create: { userId: user.id, name: d.customerName, email: d.customerEmail.toLowerCase() },
      update: { name: d.customerName },
    });

    const invoice = await db.invoice.create({
      data: {
        userId: user.id,
        customerId: customer.id,
        number: d.number,
        amountCents: d.amountCents,
        currency: d.currency.toUpperCase(),
        issuedAt: new Date(d.issuedAt),
        dueAt: new Date(d.dueAt),
        paymentUrl: d.paymentUrl || null,
        notes: d.notes || null,
        source: "manual",
        status: "active",
      },
    });

    await syncScheduleForInvoice(invoice.id);
    logEvent(user.id, "invoice_created", { invoiceId: invoice.id, source: "manual" });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: `Invoice number "${d.number}" already exists.` }, { status: 409 });
    }
    console.error("invoice create failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
