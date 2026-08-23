import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card, StatusBadge, Badge } from "@/components/ui";
import { NewInvoiceForm } from "@/components/new-invoice-form";
import { CsvImport } from "@/components/csv-import";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices" };

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

type InvoicesPageProps = { searchParams: Promise<{ new?: string }> };

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;

  const invoices = await db.invoice.findMany({
    where: { userId: user.id },
    include: { customer: true },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 500,
  });

  const nextChases = await db.scheduledEmail.findMany({
    where: { status: "pending", invoice: { userId: user.id } },
    orderBy: { plannedFor: "asc" },
    take: 1000,
  });
  const nextByInvoice = new Map<string, (typeof nextChases)[number]>();
  for (const c of nextChases) if (!nextByInvoice.has(c.invoiceId)) nextByInvoice.set(c.invoiceId, c);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-neutral-500">Everything you&apos;re chasing, in one place.</p>
        </div>
        <a href="/api/export" className="text-sm font-medium text-indigo-600 hover:underline">Export CSV ↓</a>
      </div>

      <NewInvoiceForm defaultNewOpen={sp.new === "1"} />
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-neutral-500 hover:text-neutral-800">
          ▸ Import many invoices at once (CSV)
        </summary>
        <div className="mt-3">
          <CsvImport />
        </div>
      </details>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Invoice</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Due</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Next chase</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {invoices.map((inv) => {
              const daysLate = Math.floor((Date.now() - inv.dueAt.getTime()) / 86400000);
              const next = nextByInvoice.get(inv.id);
              return (
                <tr key={inv.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <Link href={`/app/invoices/${inv.id}`} className="font-medium hover:text-indigo-600">{inv.number}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <div>{inv.customer.name}</div>
                    <div className="text-xs text-neutral-400">{inv.customer.email}</div>
                  </td>
                  <td className="px-5 py-3 tabular-nums">{money(inv.amountCents, inv.currency)}</td>
                  <td className="px-5 py-3">
                    {inv.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {inv.status === "active" && daysLate > 0 && (
                      <span className="ml-1 text-xs text-red-600">+{daysLate}d</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={inv.status} />
                    {!inv.chasingEnabled && inv.status === "active" && <span className="ml-1"><Badge>paused</Badge></span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-600">
                    {inv.status === "active" && inv.chasingEnabled && next
                      ? `${next.stepLabel} · ${next.plannedFor.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-neutral-400">
                  No invoices yet — add one above and Paidhound builds the schedule instantly.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
