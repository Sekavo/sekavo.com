import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import {
  Money, PageHeader, Td, Th, btn, cn, invoiceStatusView,
  shortDate, StatusLine, EmptyState,
} from "@/components/ui";
import { NewInvoiceForm } from "@/components/new-invoice-form";
import { CsvImport } from "@/components/csv-import";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices" };

const DAY = 86_400_000;

type Tab = "all" | "overdue" | "paid";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; status?: string; customer?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const tab = (["all", "overdue", "paid"].includes(sp.status ?? "") ? sp.status : "all") as Tab;
  const plan = effectivePlan(
    (user.subscription?.plan as never) ?? "free",
    user.subscription?.status ?? "active",
    user.trialEndsAt
  );
  const planCanImport = plan.csvImport;

  const invoices = await db.invoice.findMany({
    where: { userId: user.id },
    include: { customer: true },
    orderBy: [{ dueAt: "asc" }],
    take: 500,
  });

  const now = Date.now();
  const withDerived = invoices.map((inv) => ({
    ...inv,
    daysLate: Math.floor((now - inv.dueAt.getTime()) / DAY),
  }));
  const counts = {
    all: withDerived.length,
    overdue: withDerived.filter((i) => i.status === "active" && i.daysLate > 0).length,
    paid: withDerived.filter((i) => i.status === "paid").length,
  };

  let visible = withDerived;
  if (sp.customer) visible = visible.filter((i) => i.customerId === sp.customer);
  if (tab === "overdue") visible = visible.filter((i) => i.status === "active" && i.daysLate > 0);
  if (tab === "paid") visible = visible.filter((i) => i.status === "paid");

  // Next pending chase per invoice
  const nextChases = await db.scheduledEmail.findMany({
    where: { status: "pending", invoice: { userId: user.id } },
    orderBy: { plannedFor: "asc" },
    take: 1000,
  });
  const nextByInvoice = new Map<string, (typeof nextChases)[number]>();
  for (const c of nextChases) if (!nextByInvoice.has(c.invoiceId)) nextByInvoice.set(c.invoiceId, c);

  const filterCustomer = sp.customer
    ? (await db.customer.findFirst({ where: { id: sp.customer, userId: user.id } }))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Everything you're chasing. Paid, paused and closed invoices don't count against your plan."
        actions={<a href="/api/export" className={btn.secondary}>Export CSV</a>}
      />

      <NewInvoiceForm defaultNewOpen={sp.new === "1"} defaultPaymentUrl={user.settings?.defaultPaymentUrl ?? ""} />

      {planCanImport && (
        <details className="group">
          <summary className="cursor-pointer text-[13px] font-medium text-ink-soft hover:text-ink">
            Import from CSV
          </summary>
          <div className="mt-3">
            <CsvImport />
          </div>
        </details>
      )}

      {/* Filter row */}
      <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <div className="flex gap-5">
          {(["all", "overdue", "paid"] as Tab[]).map((t) => (
            <Link
              key={t}
              href={linkFor(t, sp.customer)}
              className={cn(
                "-mb-px border-b-2 pb-2.5 text-sm transition-colors",
                tab === t
                  ? "border-pine-600 font-semibold text-ink"
                  : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink"
              )}
            >
              {t === "all" ? "All" : t === "overdue" ? "Overdue" : "Paid"}
              <span className="tnum ml-1.5 text-xs text-ink-faint">{counts[t]}</span>
            </Link>
          ))}
        </div>
        {filterCustomer && (
          <span className="pb-2.5 text-[13px] text-ink-soft">
            Customer: <strong className="font-medium text-ink">{filterCustomer.name}</strong>{" "}
            <Link href={linkFor(tab, undefined)} className="ml-1 text-pine-700 hover:underline">(clear)</Link>
          </span>
        )}
      </nav>

      {visible.length === 0 ? (
        counts.all === 0 ? (
          <EmptyState title="No invoices yet" action={<Link href="/app/invoices?new=1" className={btn.primary}>Add your first invoice</Link>}>
            Add the invoices people owe you — Paidhound builds a chase schedule for each one automatically.
          </EmptyState>
        ) : (
          <EmptyState title="Nothing here">No invoices match this filter.</EmptyState>
        )
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Customer</Th>
                <Th className="text-right">Amount</Th>
                <Th className="hidden md:table-cell">Due</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Next chase</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((inv) => {
                const status = invoiceStatusView(inv.status);
                const paused = inv.status === "active" && !inv.chasingEnabled;
                const overdue = inv.status === "active" && inv.daysLate > 0;
                const next = nextByInvoice.get(inv.id);
                return (
                  <tr key={inv.id} className="group transition-colors hover:bg-white">
                    <Td>
                      <Link href={`/app/invoices/${inv.id}`} className="block group-hover:text-pine-700">
                        <span className="font-mono text-[13px] font-medium">{inv.number}</span>
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          issued {shortDate(inv.issuedAt)}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <span className="font-medium">{inv.customer.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-faint">{inv.customer.email}</span>
                    </Td>
                    <Td className="text-right">
                      <Money cents={inv.amountCents} currency={inv.currency} className="font-medium" />
                    </Td>
                    <Td className="tnum hidden text-ink-soft md:table-cell">
                      {shortDate(inv.dueAt)}
                      {overdue && (
                        <span className="tnum ml-1.5 font-semibold text-overdue">+{inv.daysLate}d</span>
                      )}
                    </Td>
                    <Td>
                      <StatusLine tone={status.tone}>{paused ? "Paused" : status.label}</StatusLine>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      {inv.status === "active" && inv.chasingEnabled && next ? (
                        <>
                          <span className="text-[13px] font-medium text-ink">{next.stepLabel}</span>
                          <span className="block text-xs text-ink-faint">{shortDate(next.plannedFor)}</span>
                        </>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-faint">
        Showing {visible.length} of {counts.all} invoices. Chase schedules adjust automatically when you edit an
        invoice — see <Link href="/app/sequences" className="underline underline-offset-2 hover:text-ink">chase sequences</Link>.
      </p>
    </div>
  );
}

function linkFor(tab: Tab, customer?: string) {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (customer) params.set("customer", customer);
  const qs = params.toString();
  return `/app/invoices${qs ? `?${qs}` : ""}`;
}
