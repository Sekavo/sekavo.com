import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await db.invoice.findMany({
    where: { userId: user.id },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const header = ["invoice_number", "customer_name", "customer_email", "amount", "currency", "issue_date", "due_date", "paid_date", "status"];
  const rows = invoices.map((i) =>
    [
      i.number,
      i.customer.name,
      i.customer.email,
      (i.amountCents / 100).toFixed(2),
      i.currency,
      i.issuedAt.toISOString().slice(0, 10),
      i.dueAt.toISOString().slice(0, 10),
      i.paidAt?.toISOString().slice(0, 10) ?? "",
      i.status,
    ]
      .map(csvEscape)
      .join(",")
  );

  return new NextResponse([header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paidhound-invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
