import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { EmptyState, Money, PageHeader, Td, Th, cn } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

const DAY = 86_400_000;

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
      const overdue = active.filter((i) => i.dueAt.getTime() < now);
      return {
        ...c,
        outstanding: active.reduce((s, i) => s + i.amountCents, 0),
        openCount: active.length,
        overdueCount: overdue.length,
        oldestLateDays: overdue.length ? Math.max(...overdue.map((i) => Math.floor((now - i.dueAt.getTime()) / DAY))) : 0,
        paidCount: c.invoices.filter((i) => i.status === "paid").length,
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding);

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${customers.length} customer${customers.length === 1 ? "" : "s"} · ${totalOutstanding > 0 ? `${Math.round(totalOutstanding / 100).toLocaleString()} outstanding across the book` : "nothing outstanding"}`}
      />

      {rows.length === 0 ? (
        <EmptyState title="No customers yet">Customers appear here as you add invoices.</EmptyState>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">Open</Th>
                <Th>Oldest late</Th>
                <Th className="hidden text-right sm:table-cell">Paid before</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-white">
                  <Td>
                    <Link href={`/app/invoices?customer=${c.id}`} className="block group-hover:text-pine-700">
                      <span className="font-medium">{c.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-faint">{c.email}</span>
                    </Link>
                  </Td>
                  <Td className="text-right">
                    {c.outstanding > 0 ? (
                      <Money cents={c.outstanding} className="font-semibold" />
                    ) : (
                      <span className="tnum text-ink-faint">$0</span>
                    )}
                  </Td>
                  <Td className="tnum text-right">{c.openCount || <span className="text-ink-faint">—</span>}</Td>
                  <Td>
                    {c.oldestLateDays > 0 ? (
                      <span className={cn("tnum font-medium", c.oldestLateDays > 60 ? "text-overdue" : "text-caution")}>
                        {c.oldestLateDays} days
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Td>
                  <Td className="tnum hidden text-right text-ink-soft sm:table-cell">{c.paidCount}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
