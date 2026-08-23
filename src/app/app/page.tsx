import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import {
  Eyebrow, Money, PageHeader, StatusLine, Surface, Td, Th,
  btn, cn, relTime, shortDate,
} from "@/components/ui";

const DAY = 86_400_000;

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function StatCell({
  label, value, caption, valueClass = "", className = "",
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("px-5 py-4 sm:px-6", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <p className={cn("tnum mt-1.5 font-display text-[26px] font-semibold leading-none tracking-[-0.01em]", valueClass)}>
        {value}
      </p>
      {caption && <p className="mt-1.5 text-xs text-ink-soft">{caption}</p>}
    </div>
  );
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
      where: { userId: user.id, status: "paid", paidAt: { gte: new Date(Date.now() - 30 * DAY) } },
      select: { amountCents: true, issuedAt: true, paidAt: true },
    }),
  ]);

  const now = Date.now();
  const outstanding = activeInvoices.reduce((s, i) => s + i.amountCents, 0);
  const overdueInv = activeInvoices.filter((i) => i.dueAt.getTime() < now);
  const overdueSum = overdueInv.reduce((s, i) => s + i.amountCents, 0);
  const collected30 = paidRecent.reduce((s, i) => s + i.amountCents, 0);
  const avgDaysToPay =
    paidRecent.length > 0
      ? Math.round(
          paidRecent.reduce((s, i) => s + ((i.paidAt?.getTime() ?? now) - i.issuedAt.getTime()) / DAY, 0) /
            paidRecent.length
        )
      : null;

  // Aging buckets
  const buckets = [
    { label: "Not yet due", test: (d: number) => d <= 0 },
    { label: "1–30 days late", test: (d: number) => d > 0 && d <= 30 },
    { label: "31–60 days late", test: (d: number) => d > 30 && d <= 60 },
    { label: "61–90 days late", test: (d: number) => d > 60 && d <= 90 },
    { label: "Over 90 days late", test: (d: number) => d > 90 },
  ].map((b) => {
    const invs = activeInvoices.filter((i) => b.test((now - i.dueAt.getTime()) / DAY));
    return { label: b.label, total: invs.reduce((s, i) => s + i.amountCents, 0), count: invs.length };
  });
  const maxBucket = Math.max(...buckets.map((b) => b.total), 1);

  const [nextChases, activity, failedSends, totalInvoices, bouncedCount] = await Promise.all([
    db.scheduledEmail.findMany({
      where: { status: "pending", invoice: { userId: user.id } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { plannedFor: "asc" },
      take: 6,
    }),
    db.conversationEvent.findMany({
      where: { invoice: { userId: user.id } },
      include: { invoice: { select: { id: true, number: true } } },
      orderBy: { occurredAt: "desc" },
      take: 8,
    }),
    db.scheduledEmail.findMany({
      where: { status: "failed", invoice: { userId: user.id } },
      include: { invoice: { select: { id: true, number: true, customer: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    db.invoice.count({ where: { userId: user.id } }),
    db.outboundEmailLog.count({
      where: { userId: user.id, kind: "chase", status: "bounced", sentAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    }),
  ]);

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const attention = [...overdueInv].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const brandNew = totalInvoices === 0;
  const identityDone = Boolean(user.settings?.onboardingDone);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Receivables"
        description="What you're owed, what's late, and what Paidhound is doing about it right now."
        actions={
          <>
            <Link href="/app/invoices" className={btn.secondary}>All invoices</Link>
            <Link href="/app/invoices?new=1" className={btn.primary}>Add invoice</Link>
          </>
        }
      />

      {/* Delivery failures — never hide these */}
      {bouncedCount > 0 && (
        <div className="border border-caution/30 bg-caution-bg px-4 py-2.5 text-sm text-caution">
          <strong className="font-semibold">{bouncedCount}</strong> chase email{bouncedCount === 1 ? "" : "s"} bounced
          in the last 30 days — the address may be wrong or the mailbox full.
        </div>
      )}
      {failedSends.length > 0 && (
        <div className="border border-overdue/30 bg-overdue-bg px-4 py-3 text-sm text-overdue">
          <p className="font-semibold">
            {failedSends.length === 1 ? "One chase email failed to deliver." : `${failedSends.length} chase emails failed to deliver.`}
          </p>
          <ul className="mt-1 space-y-0.5 text-[13px]">
            {failedSends.map((f) => (
              <li key={f.id}>
                <Link href={`/app/invoices/${f.invoiceId}`} className="font-medium underline underline-offset-2">
                  {f.invoice.number}
                </Link>{" "}
                — {f.invoice.customer.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* First-run checklist */}
      {brandNew && (
        <Surface className="px-5 py-5">
          <Eyebrow className="mb-3">Get started</Eyebrow>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border text-[11px] font-semibold ${identityDone ? "border-paid bg-paid-bg text-paid" : "border-line-strong text-ink-faint"}`}>
                {identityDone ? "✓" : "1"}
              </span>
              <p className="text-sm leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">Confirm your sender identity.</span> Chases are signed with your name and business.{" "}
                <Link href="/app/settings" className="font-medium text-pine-700 hover:underline">Open settings →</Link>
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong text-[11px] font-semibold text-ink-faint">2</span>
              <p className="text-sm leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">Add the invoice you&apos;re waiting on.</span> Paidhound schedules the full sequence immediately —{" "}
                <Link href="/app/invoices?new=1" className="font-medium text-pine-700 hover:underline">add it now →</Link>
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong text-[11px] font-semibold text-ink-faint">3</span>
              <p className="text-sm leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">Review what will be sent.</span> Every email is previewed on the invoice before it goes —{" "}
                <Link href="/app/sequences" className="font-medium text-pine-700 hover:underline">see the ladder →</Link>
              </p>
            </li>
          </ol>
        </Surface>
      )}

      {/* Figures strip — 4×1 on desktop, 2×2 on mobile, ruled like a ledger */}
      <Surface className="grid grid-cols-2 sm:grid-cols-4">
        <StatCell
          label="Outstanding"
          value={<Money cents={outstanding} />}
          caption={`${activeInvoices.length} invoice${activeInvoices.length === 1 ? "" : "s"} being chased`}
          className="border-line max-sm:border-r max-sm:border-b sm:border-r"
        />
        <StatCell
          label="Overdue"
          value={<Money cents={overdueSum} />}
          valueClass={overdueSum > 0 ? "text-overdue" : ""}
          caption={`${overdueInv.length} past due`}
          className="border-line max-sm:border-b sm:border-r"
        />
        <StatCell
          label="Collected · 30 days"
          value={<Money cents={collected30} />}
          caption={`${paidRecent.length} payments`}
          className="border-line max-sm:border-r max-sm:border-t sm:border-r sm:border-t-0"
        />
        <StatCell
          label="Avg days to pay"
          value={avgDaysToPay !== null ? `${avgDaysToPay}` : "—"}
          caption={avgDaysToPay !== null ? "from issue to payment" : "no payments yet"}
          className="border-line max-sm:border-t sm:border-t-0"
        />
      </Surface>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-8 lg:col-span-2">
          {/* Needs attention */}
          <section>
            <Eyebrow className="mb-2">Needs your attention</Eyebrow>
            <Surface>
              {attention.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-faint">
                  Nothing is overdue. Paidhound keeps it that way.
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <Th>Customer</Th>
                      <Th className="text-right">Amount</Th>
                      <Th className="hidden sm:table-cell">Due</Th>
                      <Th>Late</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.slice(0, 5).map((inv) => {
                      const late = Math.floor((now - inv.dueAt.getTime()) / DAY);
                      return (
                        <tr key={inv.id} className="group hover:bg-paper-sunken/60">
                          <Td>
                            <Link href={`/app/invoices/${inv.id}`} className="block">
                              <span className="font-medium text-ink group-hover:text-pine-700">{inv.customer.name}</span>
                              <span className="block font-mono text-xs text-ink-faint">{inv.number}</span>
                            </Link>
                          </Td>
                          <Td className="text-right">
                            <Money cents={inv.amountCents} currency={inv.currency} className="font-medium" />
                          </Td>
                          <Td className="tnum hidden text-ink-soft sm:table-cell">{shortDate(inv.dueAt)}</Td>
                          <Td>
                            <span className={cn("tnum text-[13px] font-semibold", late > 60 ? "text-overdue" : "text-caution")}>
                              {late}d
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {attention.length > 5 && (
                <div className="border-t border-line px-4 py-2.5 text-xs">
                  <Link href="/app/invoices?status=overdue" className="font-medium text-pine-700 hover:underline">
                    View all {attention.length} overdue invoices →
                  </Link>
                </div>
              )}
            </Surface>
          </section>

          {/* Upcoming chases */}
          <section>
            <Eyebrow className="mb-2">Upcoming automated chases</Eyebrow>
            <Surface>
              <ul className="divide-y divide-line">
                {nextChases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        <Link href={`/app/invoices/${c.invoiceId}`} className="font-medium hover:text-pine-700">
                          {c.invoice.customer.name}
                        </Link>
                        <span className="text-ink-faint"> · {c.stepLabel}</span>
                      </p>
                      <p className="tnum mt-0.5 text-xs text-ink-faint">
                        {c.invoice.number} · <Money cents={c.invoice.amountCents} currency={c.invoice.currency} /> ·{" "}
                        {shortDate(c.plannedFor)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-pine-700">{relTime(c.plannedFor)}</span>
                  </li>
                ))}
                {nextChases.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-ink-faint">Nothing scheduled yet.</li>
                )}
              </ul>
            </Surface>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-8">
          <section>
            <Eyebrow className="mb-2">Aging</Eyebrow>
            <Surface className="px-4 py-4">
              <dl className="space-y-3">
                {buckets.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-baseline justify-between text-xs">
                      <dt className="text-ink-soft">{b.label}</dt>
                      <dd className={cn("tnum font-medium", b.total > 0 ? "text-ink" : "text-ink-faint")}>
                        <Money cents={b.total} />
                      </dd>
                    </div>
                    <div className="mt-1 h-[3px] bg-paper-sunken">
                      <div
                        className={cn("h-full", b.label.startsWith("Not") ? "bg-pine-500" : b.total / maxBucket > 0.66 || b.label.includes("90") ? "bg-overdue" : "bg-caution")}
                        style={{ width: `${Math.max(b.total > 0 ? 2 : 0, (b.total / maxBucket) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </dl>
              {activeInvoices.length > 0 && (
                <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-faint">
                  Recovery odds drop sharply past 90 days — work the top bucket first.
                </p>
              )}
            </Surface>
          </section>

          <section>
            <Eyebrow className="mb-2">Plan</Eyebrow>
            <Surface className="px-4 py-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className="tnum text-xs text-ink-soft">
                  {activeInvoices.length}/{plan.maxActiveInvoices} invoices
                </p>
              </div>
              <div className="mt-2 h-[3px] bg-paper-sunken">
                <div
                  className={cn("h-full", activeInvoices.length >= plan.maxActiveInvoices ? "bg-overdue" : "bg-pine-600")}
                  style={{ width: `${Math.max(2, Math.min(100, (activeInvoices.length / plan.maxActiveInvoices) * 100))}%` }}
                />
              </div>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
                Paid, paused, and closed invoices don&apos;t count against your plan.
              </p>
            </Surface>
          </section>

          <section>
            <Eyebrow className="mb-2">Recent activity</Eyebrow>
            <Surface>
              <ul className="divide-y divide-line">
                {activity.map((e) => {
                  const mark =
                    e.type === "chase_sent" ? { tone: "pine" as const } :
                    e.type === "reply_received" ? { tone: "caution" as const } :
                    e.type === "payment_reported" ? { tone: "paid" as const } :
                    { tone: "neutral" as const };
                  return (
                    <li key={e.id} className="px-4 py-2.5">
                      <StatusLine tone={mark.tone}>
                        <span className="max-w-[240px] truncate text-[13px] normal-case tracking-normal text-ink-soft">
                          {e.type === "chase_sent" ? "Chase sent" : e.type === "reply_received" ? "Reply received" : e.type === "payment_reported" ? "Payment reported" : e.summary.slice(0, 40)}
                        </span>
                      </StatusLine>
                      <p className="mt-0.5 pl-[15px] text-[11px] text-ink-faint">
                        <span className="font-mono">{e.invoice.number}</span> · {relTime(e.occurredAt)}
                      </p>
                    </li>
                  );
                })}
                {activity.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-ink-faint">Activity appears once chasing starts.</li>
                )}
              </ul>
              {activity.length > 0 && (
                <div className="border-t border-line px-4 py-2.5 text-xs">
                  <Link href="/app/activity" className="font-medium text-pine-700 hover:underline">Full activity log →</Link>
                </div>
              )}
            </Surface>
          </section>
        </div>
      </div>
    </div>
  );
}
