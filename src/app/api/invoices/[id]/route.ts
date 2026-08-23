import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invoiceUpdateSchema } from "@/lib/validation";
import { cancelPendingForInvoice, syncScheduleForInvoice } from "@/lib/engine";
import { effectivePlan } from "@/lib/plans";
import { logEvent } from "@/lib/analytics";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await db.invoice.findFirst({ where: { id, userId: user.id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = invoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.number !== undefined) data.number = d.number;
  if (d.amountCents !== undefined) data.amountCents = d.amountCents;
  if (d.currency !== undefined) data.currency = d.currency.toUpperCase();
  if (d.issuedAt !== undefined) data.issuedAt = new Date(d.issuedAt);
  if (d.dueAt !== undefined) data.dueAt = new Date(d.dueAt);
  if (d.paymentUrl !== undefined) data.paymentUrl = d.paymentUrl || null;
  if (d.notes !== undefined) data.notes = d.notes || null;
  if (d.chasingEnabled !== undefined) data.chasingEnabled = d.chasingEnabled;
  if (d.status !== undefined) {
    data.status = d.status;
    if (d.status === "paid") data.paidAt = new Date();
    if (invoice.status === "paid" && d.status !== "paid") data.paidAt = null; // reopening
  }

  // Customer update (name/email)
  let customerIdChanged = false;

  try {
    const updated = await db.$transaction(async (tx) => {
      if (d.customerEmail !== undefined || d.customerName !== undefined) {
        const existingCustomer = await tx.customer.findUnique({ where: { id: invoice.customerId } });
        const newEmail = (d.customerEmail ?? existingCustomer?.email ?? "").toLowerCase();
        const newName = d.customerName ?? existingCustomer?.name ?? "";
        const customer = await tx.customer.upsert({
          where: { userId_email: { userId: user.id, email: newEmail } },
          create: { userId: user.id, name: newName, email: newEmail },
          update: { name: newName },
        });
        if (customer.id !== invoice.customerId) {
          data.customerId = customer.id;
          customerIdChanged = true;
        } else {
          await tx.customer.update({ where: { id: customer.id }, data: { name: newName } });
        }
      }
      return tx.invoice.update({ where: { id }, data });
    });

    // Side effects
    if (d.status && d.status !== "active") {
      await cancelPendingForInvoice(id, `invoice marked ${d.status}`);
      if (d.status === "paid") logEvent(user.id, "invoice_paid", { invoiceId: id });
    }
    if (
      (!d.status || d.status === "active") &&
      (data.dueAt || data.amountCents || data.chasingEnabled !== undefined || customerIdChanged)
    ) {
      await syncScheduleForInvoice(id);
    }

    return NextResponse.json({ invoice: updated });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: `Invoice number "${d.number}" already exists.` }, { status: 409 });
    }
    console.error("invoice update failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  // Clone an invoice: same customer/amount/link, new number suffix, due in 30 days.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const source = await db.invoice.findFirst({ where: { id, userId: user.id }, include: { customer: true } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const activeCount = await db.invoice.count({ where: { userId: user.id, status: "active" } });
  if (activeCount >= plan.maxActiveInvoices) {
    return NextResponse.json({ error: `Plan limit reached (${plan.maxActiveInvoices} active invoices).`, upgradeRequired: true }, { status: 402 });
  }

  const now = new Date();
  let number = `${source.number}-2`;
  for (let i = 2; i < 50; i++) {
    number = i === 2 ? `${source.number}-2` : `${source.number}-${i}`;
    const exists = await db.invoice.findUnique({ where: { userId_number: { userId: user.id, number } }, select: { id: true } });
    if (!exists) break;
  }

  const issuedAt = new Date(now.getTime() - 14 * 86400000);
  const dueAt = new Date(now.getTime() + 30 * 86400000);

  const invoice = await db.invoice.create({
    data: {
      userId: user.id,
      customerId: source.customerId,
      number,
      amountCents: source.amountCents,
      currency: source.currency,
      issuedAt,
      dueAt,
      paymentUrl: source.paymentUrl,
      source: "manual",
      status: "active",
    },
  });
  await syncScheduleForInvoice(invoice.id);
  logEvent(user.id, "invoice_created", { invoiceId: invoice.id, source: "clone" });
  return NextResponse.json({ invoice }, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await db.invoice.findFirst({ where: { id, userId: user.id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.invoice.delete({ where: { id } }); // cascades to emails + events
  logEvent(user.id, "invoice_deleted", { invoiceId: id });
  return NextResponse.json({ ok: true });
}
