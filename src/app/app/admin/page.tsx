import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { Eyebrow, Money, PageHeader, Surface, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.isAdmin) redirect("/app");

  const [totalUsers, newUsers7d, activeInvoices, emailsSent, replies, subs, recentUsers] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    db.invoice.count({ where: { status: "active" } }),
    db.scheduledEmail.count({ where: { status: "sent" } }),
    db.conversationEvent.count({ where: { type: "reply_received" } }),
    db.subscription.findMany({ select: { plan: true, status: true } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, email: true, name: true, businessName: true, createdAt: true },
    }),
  ]);

  const mrrCents = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (PLANS[s.plan as keyof typeof PLANS]?.priceMonthly ?? 0) * 100, 0);

  const byType = await db.analyticsEvent.groupBy({
    by: ["type"],
    _count: { _all: true },
    orderBy: { _count: { type: "desc" } },
    take: 10,
  });

  const cells = [
    ["Estimated MRR", <Money key="m" cents={mrrCents} />, `${subs.filter((s) => s.status === "active").length} paying`],
    ["Users", String(totalUsers), `+${newUsers7d} this week`],
    ["Active invoices", String(activeInvoices), "being chased"],
    ["Emails sent", String(emailsSent), `${replies} replies received`],
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Admin" description="Platform health — visible only to admin accounts." />

      <Surface className="grid grid-cols-2 sm:grid-cols-4">
        {cells.map(([label, value, caption], i) => (
          <div
            key={i}
            className={`border-line px-5 py-4 ${i % 2 === 0 ? "max-sm:border-r max-sm:border-b sm:border-r sm:max-lg:border-b lg:border-b-0" : "max-sm:border-b sm:max-lg:border-b lg:border-b-0"} ${i === 2 || i === 3 ? "max-sm:border-t-0" : ""}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</p>
            <p className="tnum mt-1.5 font-display text-[24px] font-semibold leading-none">{value}</p>
            <p className="mt-1.5 text-xs text-ink-soft">{caption}</p>
          </div>
        ))}
      </Surface>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <Eyebrow className="mb-2">Recent signups</Eyebrow>
          <Surface>
            <table className="w-full">
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th className="text-right">Joined</Th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <Td>
                      <span className="font-medium">{u.name}</span>
                      <span className="block text-xs text-ink-faint">{u.businessName || u.email}</span>
                    </Td>
                    <Td className="tnum text-right text-xs text-ink-soft">
                      {u.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Td>
                  </tr>
                ))}
                {recentUsers.length === 0 && (
                  <tr><Td className="py-6 text-center text-ink-faint">No users yet.</Td></tr>
                )}
              </tbody>
            </table>
          </Surface>
        </section>

        <section>
          <Eyebrow className="mb-2">Event counts</Eyebrow>
          <Surface className="divide-y divide-line">
            {byType.map((t) => (
              <div key={t.type} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ink-soft">{t.type.replace(/_/g, " ")}</span>
                <span className="tnum font-semibold">{t._count._all}</span>
              </div>
            ))}
            {byType.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-faint">No events.</p>}
          </Surface>
        </section>
      </div>
    </div>
  );
}
