import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { Card, StatCard, Badge, btn } from "@/components/ui";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [activeInvoices, paidRecent] = await Promise.all([
    db.invoice.findMany({
      where: { userId: user.id, status: "active" },
      include: { customer: true },
      orderBy: { dueAt: "asc" },
    }),
    db.invoice.findMany({
      where: { userId: user.id, status: "paid", paidAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
      select: { amountCents: true, paidAt: true, dueAt: true, issuedAt: true },
    }),
  ]);

  const now = Date.now();
  const outstanding = activeInvoices.reduce((s, i) => s + i.amountCents, 0);
  const overdueInvoices = activeInvoices.filter((i) => i.dueAt.getTime() < now);
  const overdue = overdueInvoices.reduce((s, i) => s + i.amountCents, 0);
  const collected30 = paidRecent.reduce((s, i) => s + i.amountCents, 0);
  const avgDaysToPay =
    paidRecent.length > 0
      ? Math.round(
          paidRecent.reduce((s, i) => s + ((i.paidAt?.getTime() ?? now) - i.issuedAt.getTime()) / 86400000, 0) / paidRecent.length
        )
      : null;

  // Aging buckets (AR standard)
  const buckets = [
    { label: "Not yet due", min: -Infinity, max: 0 },
    { label: "1–30 days late", min: 0.001, max: 30 },
    { label: "31–60 days", min: 30, max: 60 },
    { label: "61–90 days", min: 60, max: 90 },
    { label: "90+ days", min: 90, max: Infinity },
  ].map((b) => {
    const invs = activeInvoices.filter((i) => {
      const daysLate = (now - i.dueAt.getTime()) / 86400000;
      return daysLate > b.min && daysLate <= b.max;
    });
    return { ...b, total: invs.reduce((s, i) => s + i.amountCents, 0), count: invs.length };
  });
  const maxBucket = Math.max(...buckets.map((b) => b.total), 1);

  const [nextChases, activity] = await Promise.all([
    db.scheduledEmail.findMany({
      where: { status: "pending", invoice: { userId: user.id } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { plannedFor: "asc" },
      take: 8,
    }),
    db.conversationEvent.findMany({
      where: { invoice: { userId: user.id } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
  ]);

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const usagePct = Math.min(100, Math.round((activeInvoices.length / plan.maxActiveInvoices) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cash dashboard</h1>
          <p className="text-sm text-neutral-500">What&apos;s owed to you and what Paidhound is doing about it.</p>
        </div>
        <Link href="/app/invoices?new=1" className={btn.primary}>+ Add invoice</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding" value={money(outstanding)} sub={`${activeInvoices.length} active invoices`} />
        <StatCard label="Overdue" value={money(overdue)} sub={`${overdueInvoices.length} past due`} tone={overdue > 0 ? "danger" : "default"} />
        <StatCard label="Collected (30d)" value={money(collected30)} tone="success" />
        <StatCard label="Avg days to pay" value={avgDaysToPay !== null ? `${avgDaysToPay}d` : "—"} sub="last 30 days of payments" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Aging */}
        <Card className="lg:col-span-3">
          <h2 className="font-semibold">Receivables aging</h2>
          {activeInvoices.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {buckets.map((b) => (
                  <div key={b.label}>
                    <div className="mb-1 flex justify-between text-xs text-neutral-600">
                      <span>{b.label} <span className="text-neutral-400">({b.count})</span></span>
                      <span className="font-medium tabular-nums">{money(b.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full rounded-full ${b.label === "Not yet due" ? "bg-indigo-400" : b.max <= 30 ? "bg-amber-400" : "bg-red-500"}`}
                        style={{ width: `${Math.max(2, (b.total / maxBucket) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                Focus first on the oldest bucket — recovery probability drops sharply after 90 days.
              </p>
            </>
          )}
        </Card>

        {/* Plan usage */}
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Chase capacity</h2>
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">{plan.name} plan</span>
              <span className="font-medium tabular-nums">{activeInvoices.length}/{plan.maxActiveInvoices}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className={`h-full rounded-full ${usagePct >= 100 ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${Math.max(usagePct, 3)}%` }} />
            </div>
            {plan.id === "free" && (
              <p className="mt-3 text-xs text-neutral-500">
                Free plan chases your 3 oldest invoices. <Link href="/app/billing" className="font-medium text-indigo-600 hover:underline">Upgrade</Link> to chase everything.
              </p>
            )}
            {trialingNote(sub?.status ?? "", user.trialEndsAt)}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Next chases</h2>
            <Link href="/app/invoices" className="text-xs font-medium text-indigo-600 hover:underline">All invoices →</Link>
          </div>
          <ul className="mt-4 divide-y divide-neutral-100">
            {nextChases.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/app/invoices/${c.invoiceId}`} className="truncate font-medium hover:text-indigo-600">
                    {c.invoice.customer.name}
                  </Link>
                  <div className="truncate text-xs text-neutral-500">{c.stepLabel} · {c.invoice.number} · {money(c.invoice.amountCents)}</div>
                </div>
                <Badge tone="blue">{relativeDay(c.plannedFor)}</Badge>
              </li>
            ))}
            {nextChases.length === 0 && <li className="py-6 text-center text-sm text-neutral-400">Nothing scheduled yet.</li>}
          </ul>
        </Card>

        {/* Activity */}
        <Card>
          <h2 className="font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3">
            {activity.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5">
                  {e.type === "chase_sent" ? "📧" : e.type === "reply_received" ? "💬" : e.type === "payment_reported" ? "💵" : e.type === "manual_note" ? "📝" : "ℹ️"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-neutral-800">{e.summary}</div>
                  <div className="text-xs text-neutral-400">
                    <Link href={`/app/invoices/${e.invoiceId}`} className="hover:text-indigo-600">{e.invoice.number}</Link> · {timeAgo(e.occurredAt)}
                  </div>
                </div>
              </li>
            ))}
            {activity.length === 0 && <li className="py-6 text-center text-sm text-neutral-400">Activity will appear here once chasing starts.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function trialingNote(status: string, trialEndsAt: Date | null) {
  if (status !== "trialing" || !trialEndsAt) return null;
  const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
  if (daysLeft <= 5) {
    return (
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Trial ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}.{" "}
        <a href="/app/billing" className="font-semibold underline">Keep Pro features →</a>
      </p>
    );
  }
  return null;
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-6 text-center">
      <p className="text-sm font-medium text-neutral-700">No invoices yet</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-neutral-500">
        Add the invoices people owe you — Paidhound builds the chase schedule automatically.
      </p>
      <Link href="/app/invoices?new=1" className={`${btn.primary} mt-4`}>Add your first invoice</Link>
    </div>
  );
}

function relativeDay(d: Date): string {
  const diff = d.getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return mins <= 1 ? "any moment" : `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const dynamic = "force-dynamic";
