import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { Card, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.isAdmin) redirect("/app");

  const [totalUsers, newUsers7d, activeInvoices, emailsSent, replies, subs, recentUsers] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    db.invoice.count({ where: { status: "active" } }),
    db.scheduledEmail.count({ where: { status: "sent" } }),
    db.conversationEvent.count({ where: { type: "reply_received" } }),
    db.subscription.findMany({ select: { plan: true, status: true } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, email: true, name: true, businessName: true, createdAt: true },
    }),
  ]);

  // MRR estimate from subscriptions (trials excluded)
  const mrrCents = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + ((PLANS[s.plan as keyof typeof PLANS]?.priceMonthly ?? 0) * 100), 0);

  const byType = await db.analyticsEvent.groupBy({
    by: ["type"],
    _count: { _all: true },
    orderBy: { _count: { type: "desc" } },
    take: 12,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-neutral-500">Platform health and growth metrics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Estimated MRR" value={money(mrrCents)} sub={`${subs.filter((s) => s.status === "active").length} paid subs`} tone="success" />
        <StatCard label="Total users" value={String(totalUsers)} sub={`+${newUsers7d} in last 7 days`} />
        <StatCard label="Active invoices chased" value={String(activeInvoices)} />
        <StatCard label="Chase emails sent / replies" value={`${emailsSent} / ${replies}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Recent signups</h2>
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium">{u.name}</span>{" "}
                  <span className="text-neutral-400">{u.email}</span>
                </span>
                <span className="text-xs text-neutral-400">{u.createdAt.toLocaleDateString()}</span>
              </li>
            ))}
            {recentUsers.length === 0 && <li className="py-3 text-neutral-400">No users yet.</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold">Event counts</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {byType.map((t) => (
              <li key={t.type} className="flex justify-between">
                <span className="text-neutral-600">{t.type}</span>
                <span className="tabular-nums font-medium">{t._count._all}</span>
              </li>
            ))}
            {byType.length === 0 && <li className="py-3 text-neutral-400">No events.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
