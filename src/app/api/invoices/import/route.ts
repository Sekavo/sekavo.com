import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { syncScheduleForInvoice } from "@/lib/engine";
import { logEvent } from "@/lib/analytics";
import { effectivePlan } from "@/lib/plans";

interface Row {
  customer_name?: string;
  customer_email?: string;
  invoice_number?: string;
  amount?: string;
  currency?: string;
  issue_date?: string;
  due_date?: string;
  payment_url?: string;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  if (!plan.csvImport) {
    return NextResponse.json({ error: "CSV import requires the Starter plan or higher.", upgradeRequired: true }, { status: 402 });
  }

  let csv = "";
  try {
    const declaredLen = Number(req.headers.get("content-length") ?? "0");
    if (declaredLen > 2_000_000) return NextResponse.json({ error: "CSV too large (max 2MB)." }, { status: 413 });
    csv = await req.text();
    if (csv.length > 2_000_000) return NextResponse.json({ error: "CSV too large (max 2MB)." }, { status: 413 });
  } catch {
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }
  if (!csv.trim()) return NextResponse.json({ error: "Empty CSV." }, { status: 400 });

  const parsedCsv = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_") });
  if (!parsedCsv.data.length) return NextResponse.json({ error: "No data rows found." }, { status: 400 });

  const activeCount = await db.invoice.count({ where: { userId: user.id, status: "active" } });
  let capacity = plan.maxActiveInvoices - activeCount;

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const [i, row] of parsedCsv.data.entries()) {
    if (capacity <= 0) {
      skipped++;
      continue;
    }
    const lineNo = i + 2; // header + 1-index
    const name = row.customer_name?.trim();
    const email = row.customer_email?.trim().toLowerCase();
    const number = row.invoice_number?.trim();
    const amountCents = Math.round(parseFloat(row.amount ?? "") * 100);
    const issuedAt = parseDate(row.issue_date) ?? new Date();
    const dueAt = parseDate(row.due_date);
    const currency = (row.currency?.trim() || "USD").toUpperCase();

    if (!name || !email || !number || !amountCents || amountCents <= 0 || !dueAt) {
      errors.push(`Line ${lineNo}: missing/invalid ${!name ? "customer_name" : !email ? "customer_email" : !number ? "invoice_number" : !amountCents ? "amount" : "due_date"}`);
      continue;
    }

    try {
      const customer = await db.customer.upsert({
        where: { userId_email: { userId: user.id, email } },
        create: { userId: user.id, name, email },
        update: { name },
      });
      const invoice = await db.invoice.create({
        data: {
          userId: user.id,
          customerId: customer.id,
          number,
          amountCents,
          currency,
          issuedAt,
          dueAt,
          paymentUrl: row.payment_url?.trim() || null,
          source: "csv",
          status: "active",
        },
      });
      await syncScheduleForInvoice(invoice.id);
      imported++;
      capacity--;
    } catch {
      errors.push(`Line ${lineNo}: could not import (duplicate invoice number?)`);
    }
  }

  logEvent(user.id, "csv_import", { imported, skipped: skipped + errors.length });
  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 20) });
}
