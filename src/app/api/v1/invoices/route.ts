import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { invoiceCreateSchema } from "@/lib/validation";
import { syncScheduleForInvoice } from "@/lib/engine";
import { effectivePlan } from "@/lib/plans";
import { logEvent } from "@/lib/analytics";

async function authenticate(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!raw) return null;
  const hash = createHash("sha256").update(raw).digest("hex");
  const key = await db.apiKey.findUnique({
    where: { hash },
    include: { user: { include: { subscription: true } } },
  });
  if (!key || key.revokedAt) return null;
  return key;
}

/**
 * Public API (Pro+): create an invoice and start chasing it.
 * POST /api/v1/invoices   Authorization: Bearer skv_live_...
 */
export async function POST(req: NextRequest) {
  const key = await authenticate(req);
  if (!key) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const plan = effectivePlan(
    (key.user.subscription?.plan as never) ?? "free",
    key.user.subscription?.status ?? "active",
    key.user.trialEndsAt
  );
  if (!plan.apiAccess) {
    return NextResponse.json({ error: "API access requires the Pro plan.", upgradeRequired: true }, { status: 402 });
  }

  await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });

  const declaredLen = Number(req.headers.get("content-length") ?? "0");
  if (declaredLen > 256_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const raw = await req.text();
  if (raw.length > 256_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const d = parsed.data;

  const activeCount = await db.invoice.count({ where: { userId: key.userId, status: "active" } });
  if (activeCount >= plan.maxActiveInvoices) {
    return NextResponse.json({ error: `Plan limit reached (${plan.maxActiveInvoices} active invoices).`, upgradeRequired: true }, { status: 402 });
  }

  try {
    const customer = await db.customer.upsert({
      where: { userId_email: { userId: key.userId, email: d.customerEmail.toLowerCase() } },
      create: { userId: key.userId, name: d.customerName, email: d.customerEmail.toLowerCase() },
      update: { name: d.customerName },
    });
    const invoice = await db.invoice.create({
      data: {
        userId: key.userId,
        customerId: customer.id,
        number: d.number,
        amountCents: d.amountCents,
        currency: d.currency.toUpperCase(),
        issuedAt: new Date(d.issuedAt),
        dueAt: new Date(d.dueAt),
        paymentUrl: d.paymentUrl || null,
        notes: d.notes || null,
        source: "api",
        status: "active",
      },
    });
    await syncScheduleForInvoice(invoice.id);
    logEvent(key.userId, "invoice_created", { invoiceId: invoice.id, source: "api" });
    return NextResponse.json({ invoice: { id: invoice.id, number: invoice.number, dueAt: invoice.dueAt } }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: `Invoice number "${d.number}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
