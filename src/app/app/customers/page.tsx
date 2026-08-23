import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const customers = await db.customer.findMany({
    where: { userId: user.id },
    select: {
      id: true, name: true, email: true,
      invoices: { select: { status: true, amountCents: true, dueAt: true } },
    },
    orderBy: { name: "asc" },
    take: 1000,
  });

  const now = Date.now();
  const rows = customers
    .map((c) => {
      const active = c.invoices.filter((i) => i.status === "active");
      const outstanding = active.reduce((s, i) => s + i.amountCents, 0);
      const overdue = active.filter((i) => i.dueAt.getTime() < now);
      const oldestLateDays = overdue.length
        ? Math.max(...overdue.map((i) => Math.floor((now - i.dueAt.getTime()) / 86400000)))
        : 0;
      const paidCount = c.invoices.filter((i) => i.status === "paid").length;
      return { ...c, active, outstanding, overdueCount: overdue.length, oldestLateDays, paidCount };
    })
    .sort((a, b) => b.outstanding - a.outstanding);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-neutral-500">Who owes you what — sorted by outstanding balance.</p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Outstanding</th>
              <th className="px-5 py-3 font-medium">Open invoices</th>
              <th className="px-5 py-3 font-medium">Oldest late</th>
              <th className="px-5 py-3 font-medium">Paid historically</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50">
                <td className="px-5 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-neutral-400">{c.email}</div>
                </td>
                <td className={`px-5 py-3 tabular-nums ${c.overdueCount > 0 ? "font-semibold text-red-600" : ""}`}>{money(c.outstanding)}</td>
                <td className="px-5 py-3">
                  {c.active.length}
                  {c.active.length > 0 && (
                    <span className="ml-2 text-xs">
                      <Link href="/app/invoices" className="text-indigo-600 hover:underline">view →</Link>
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {c.oldestLateDays > 0 ? (
                    <span className={c.oldestLateDays > 60 ? "font-semibold text-red-600" : "text-amber-600"}>{c.oldestLateDays}d</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3 text-neutral-600">{c.paidCount}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-400">No customers yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
