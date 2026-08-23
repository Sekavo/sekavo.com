import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { Card } from "@/components/ui";
import { ApiKeysSection, PlanButtons } from "@/components/billing-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const trialing = sub?.status === "trialing" && user.trialEndsAt && new Date(user.trialEndsAt) > new Date();

  const keys = await db.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { id: true, name: true, prefix: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing & plans</h1>
        <p className="text-sm text-neutral-500">Priced by how many invoices you&apos;re actively chasing.</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">Current plan</p>
            <p className="text-xl font-bold">
              {trialing ? `Pro trial` : plan.name}
              {trialing && user.trialEndsAt && (
                <span className="ml-2 text-sm font-normal text-amber-700">
                  ends {new Date(user.trialEndsAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
          {sub?.cancelAtPeriodEnd && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Cancels at period end — resubscribe to keep chasing
            </span>
          )}
        </div>
      </Card>

      <PlanButtons currentPlan={trialing ? "__trial__" : (sub?.plan ?? "free")} />

      <ApiKeysSection
        initialKeys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() }))}
      />
    </div>
  );
}
