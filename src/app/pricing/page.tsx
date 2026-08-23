import Link from "next/link";
import { Logo, btn, Card } from "@/components/ui";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Pricing" };

const comparison = [
  ["Chaser", "$259/mo+", "Turnover-band pricing, sales-led"],
  ["Upflow", "~$440/mo (quote)", "Quote-only, annual contracts, mid-market focus"],
  ["Paidnice", "$69/mo", "Requires Xero/QuickBooks"],
  ["Native QB/Xero reminders", "Free", "Static, no reply handling, easy to ignore"],
  ["Paidhound", "$19–149/mo", "Self-serve, works with anything, reply-aware"],
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-neutral-600 hover:text-neutral-900">Home</Link>
            <Link href="/login" className="text-neutral-600 hover:text-neutral-900">Log in</Link>
            <Link href="/signup" className={btn.primary}>Start free trial</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-center text-4xl font-bold tracking-tight">Pricing that fits a one-person finance team</h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-neutral-600">
          You pay for the number of invoices being actively chased. Pause, stop or
          delete an invoice and the capacity frees up immediately. Every paid plan
          starts with 14 days of Pro — no card required.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {Object.values(PLANS).map((p) => (
            <div key={p.id} className={`flex flex-col rounded-xl border bg-white p-6 ${p.id === "pro" ? "border-indigo-600 ring-2 ring-indigo-600" : "border-neutral-200"}`}>
              {p.id === "pro" && <span className="mb-2 w-fit rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Most popular</span>}
              <h3 className="font-semibold">{p.name}</h3>
              <div className="mt-1 text-sm text-neutral-500">{p.tagline}</div>
              <div className="mt-3 text-3xl font-bold">
                ${p.priceMonthly}<span className="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-neutral-600">
                <li>✓ {p.maxActiveInvoices === 3 ? "3" : p.maxActiveInvoices} active chased invoices</li>
                <li>✓ Escalating sequence + reply detection</li>
                <li>✓ Payment links in every reminder</li>
                <li>✓ AR aging dashboard + daily digest</li>
                {p.customTemplates ? <li>✓ Fully custom sequences & tone</li> : <li className="text-neutral-400">Default sequence</li>}
                {p.csvImport ? <li>✓ CSV import</li> : <li className="text-neutral-400">No CSV import</li>}
                {p.apiAccess ? <li>✓ REST API</li> : <li className="text-neutral-400">No API</li>}
                {p.removeBranding ? <li>✓ White-label footer removed</li> : <li className="text-neutral-400">Paidhound footer on emails</li>}
              </ul>
              <Link href="/signup" className={`mt-6 ${p.id === "pro" ? btn.primary : btn.secondary}`}>
                Start with {p.name}
              </Link>
            </div>
          ))}
        </div>

        <Card className="mt-16 overflow-x-auto">
          <h2 className="text-lg font-semibold">How this compares</h2>
          <table className="mt-4 w-full min-w-[560px] text-left text-sm">
            <thead className="text-neutral-500">
              <tr><th className="py-2 font-medium">Tool</th><th className="py-2 font-medium">Entry price</th><th className="py-2 font-medium">The catch</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {comparison.map(([n, pr, note]) => (
                <tr key={n} className={n === "Paidhound" ? "bg-indigo-50/60 font-medium" : ""}>
                  <td className="py-2.5">{n}</td>
                  <td className="py-2.5">{pr}</td>
                  <td className="py-2.5 text-neutral-600">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="mx-auto mt-16 max-w-2xl">
          <h2 className="text-xl font-semibold">Questions people actually ask</h2>
          <dl className="mt-6 space-y-6 text-sm leading-relaxed">
            <div>
              <dt className="font-semibold">Do my customers see &ldquo;Paidhound&rdquo;?</dt>
              <dd className="mt-1 text-neutral-600">Emails are signed with your business name and signature. Free and Starter plans include a small footer line; Pro and Agency remove it entirely.</dd>
            </div>
            <div>
              <dt className="font-semibold">What counts as an &ldquo;active invoice&rdquo;?</dt>
              <dd className="mt-1 text-neutral-600">Any unpaid invoice currently being chased. Paid, void or paused invoices don&apos;t count against your plan.</dd>
            </div>
            <div>
              <dt className="font-semibold">Can I stop chasing someone instantly?</dt>
              <dd className="mt-1 text-neutral-600">Yes — pause an invoice or mark it paid and all scheduled emails cancel immediately.</dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}
