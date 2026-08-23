import { MarketingHeader, SiteFooter } from "@/components/marketing";
import { PricingTable, ComparisonStrip } from "@/components/pricing-table";
import Link from "next/link";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingHeader />

      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-700">Pricing</p>
        <h1 className="mt-2 max-w-2xl font-display text-[34px] font-semibold leading-tight tracking-[-0.01em] sm:text-[40px]">
          One metric: invoices being actively chased.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          You pay for the invoices Sekavo is working on right now. The moment one is paid,
          paused or closed, it frees up capacity. Every account starts with 14 days of Pro —
          no card required.
        </p>

        <div className="mt-10">
          <PricingTable cta="choose" />
        </div>

        {/* How the metric works */}
        <section className="mt-14 grid gap-x-12 gap-y-6 border-t border-line pt-10 md:grid-cols-3">
          {[
            ["What counts as active", "Any invoice with a live chase sequence — scheduled or paused mid-conversation. Paid, void and disputed invoices are always free."],
            ["What happens at the limit", "Your three most urgent invoices keep getting chased (oldest first). Newer ones wait in line until you upgrade or close one out."],
            ["Changing plans", "Upgrades apply through Stripe Checkout immediately; downgrades take effect at period end. Cancel any time from the billing portal."],
          ].map(([t, b]) => (
            <div key={t}>
              <h2 className="text-sm font-semibold">{t}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{b}</p>
            </div>
          ))}
        </section>

        {/* Comparison */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold">How this compares</h2>
          <p className="mb-5 mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
            Dedicated AR platforms start where small teams end. Native reminders are free but fire blindly.
          </p>
          <ComparisonStrip />
        </section>

        {/* FAQ */}
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="text-lg font-semibold">Questions people ask before paying</h2>
          <dl className="mt-5 max-w-3xl space-y-6">
            {[
              ["Will my customers see “Sekavo”?", "Emails are signed with your business name and your signature. On Free and Starter plans a single footer line mentions Sekavo; Pro and Agency remove it completely."],
              ["Can I stop everything instantly?", "Yes. Pause an invoice with one click or mark it paid — every scheduled email cancels immediately, including ones queued seconds away."],
              ["What if a customer replies mid-sequence?", "Chasing pauses automatically for your chosen grace window and the reply is forwarded to you. If nothing is resolved by then, the ladder resumes."],
              ["Do I have to change how I invoice?", "No. Sekavo sits on top of whatever you use today — QuickBooks, Xero, FreshBooks, Wave, Stripe payment links, PDFs from Word."],
            ].map(([q, a]) => (
              <div key={q} className="border-b border-line pb-5 last:border-b-0">
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border border-line bg-white px-6 py-6">
          <p className="font-display text-xl font-semibold">Start with the invoice that annoys you most.</p>
          <Link href="/signup" className="bg-pine-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-pine-800">
            Start free trial →
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
