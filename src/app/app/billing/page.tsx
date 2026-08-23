import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { Eyebrow, PageHeader, Surface } from "@/components/ui";
import { ApiKeysSection, PlanTable } from "@/components/billing-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & API" };

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const trialing = Boolean(sub?.status === "trialing" && user.trialEndsAt && new Date(user.trialEndsAt) > new Date());

  const [activeCount, keys] = await Promise.all([
    db.invoice.count({ where: { userId: user.id, status: "active" } }),
    db.apiKey.findMany({
      where: { userId: user.id, revokedAt: null },
      select: { id: true, name: true, prefix: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <PageHeader
          title="Billing"
          description="One metric: invoices being actively chased. Paid, paused and closed ones are always free."
        />

        {/* Usage strip */}
        <Surface>
          <div className="grid grid-cols-2 sm:grid-cols-3">
            <div className="border-line px-4 py-3.5 sm:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Current plan</p>
              <p className="mt-1 font-display text-lg font-semibold leading-none">
                {trialing ? "Pro trial" : plan.name}
                {trialing && user.trialEndsAt && (
                  <span className="ml-2 font-sans text-xs font-normal text-caution">
                    ends {new Date(user.trialEndsAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
            <div className="border-line px-4 py-3.5 max-sm:border-r max-sm:border-t sm:border-t-0 sm:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Invoices in use</p>
              <p className="tnum mt-1 font-display text-lg font-semibold leading-none">
                {activeCount}
                <span className="font-sans text-sm font-normal text-ink-faint"> / {plan.maxActiveInvoices}</span>
              </p>
              <div className="mt-2 h-[3px] bg-paper-sunken">
                <div
                  className={`h-full ${activeCount >= plan.maxActiveInvoices ? "bg-overdue" : "bg-pine-600"}`}
                  style={{ width: `${Math.max(2, Math.min(100, (activeCount / plan.maxActiveInvoices) * 100))}%` }}
                />
              </div>
            </div>
            <div className="border-line px-4 py-3.5 max-sm:border-t sm:border-t-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Renews</p>
              <p className="mt-1 text-sm font-medium leading-6">
                {sub?.currentPeriodEnd
                  ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                  : sub?.cancelAtPeriodEnd
                    ? "Cancels at period end"
                    : "—"}
              </p>
            </div>
          </div>
        </Surface>

        <PlanTable currentPlan={trialing ? "__trial__" : (sub?.plan ?? "free")} />

        {!process.env.NEXT_PUBLIC_BILLING_CONFIGURED && (
          <p className="border border-dashed border-line-strong px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
            Checkout is disabled on this deployment — set <code className="bg-paper-sunken px-1 font-mono text-xs">STRIPE_SECRET_KEY</code> and{" "}
            <code className="bg-paper-sunken px-1 font-mono text-xs">STRIPE_PRICE_*</code> to enable plan changes.
          </p>
        )}
      </div>

      <section className="space-y-6">
        <Eyebrow>Developer</Eyebrow>
        <ApiKeysSection initialKeys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() }))} />
      </section>
    </div>
  );
}


