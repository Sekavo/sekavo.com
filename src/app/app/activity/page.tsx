import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Eyebrow, PageHeader, cn, relTime } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

function eventLabel(type: string): string {
  switch (type) {
    case "chase_sent": return "Chase sent";
    case "reply_received": return "Reply received";
    case "payment_reported": return "Payment reported";
    case "manual_note": return "Note";
    default: return type.replace(/_/g, " ");
  }
}

function eventTone(type: string): string {
  switch (type) {
    case "chase_sent": return "bg-pine-500";
    case "reply_received": return "bg-caution";
    case "payment_reported": return "bg-paid";
    default: return "bg-line-strong";
  }
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const filter = sp.type && ["chase_sent", "reply_received", "payment_reported"].includes(sp.type) ? sp.type : null;

  const events = await db.conversationEvent.findMany({
    where: { invoice: { userId: user.id }, ...(filter ? { type: filter } : {}) },
    include: { invoice: { select: { id: true, number: true, customer: { select: { name: true } } } } },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  // group by calendar day
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = new Date(e.occurredAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Everything Sekavo sent, every reply that came back — newest first."
      />

      <nav className="flex gap-5 border-b border-line">
        {[{ key: null, label: "Everything" }, { key: "chase_sent", label: "Chases sent" }, { key: "reply_received", label: "Replies" }, { key: "payment_reported", label: "Payment reports" }].map((f) => (
          <Link
            key={f.label}
            href={f.key ? `/app/activity?type=${f.key}` : "/app/activity"}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm transition-colors",
              (filter ?? null) === f.key
                ? "border-pine-600 font-semibold text-ink"
                : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink"
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <div className="border border-dashed border-line-strong bg-white px-6 py-12 text-center">
          <p className="font-display text-[17px] font-semibold text-ink">No activity yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
            Once an invoice is being chased, every email sent and every customer reply shows up here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day}>
              <Eyebrow className="mb-2">{day}</Eyebrow>
              <ul className="border-t border-line">
                {list.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3 border-b border-line py-3">
                    <span aria-hidden className={cn("mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full", eventTone(e.type))} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <strong className="font-semibold">{eventLabel(e.type)}</strong>
                        <span className="text-ink-faint"> · </span>
                        <Link href={`/app/invoices/${e.invoiceId}`} className="font-mono text-xs hover:text-pine-700 hover:underline">
                          {e.invoice.number}
                        </Link>
                        <span className="text-ink-faint"> · {e.invoice.customer.name}</span>
                      </p>
                      {(e.rawText || e.summary) && (
                        <p className="mt-0.5 line-clamp-2 pr-6 text-[13px] leading-relaxed text-ink-soft">
                          {e.rawText ? `“${e.rawText.slice(0, 220)}${e.rawText.length > 220 ? "…" : ""}”` : e.summary}
                        </p>
                      )}
                    </div>
                    <time className="tnum shrink-0 text-xs text-ink-faint">{relTime(e.occurredAt)}</time>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}


