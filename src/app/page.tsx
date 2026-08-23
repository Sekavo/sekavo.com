import Link from "next/link";
import { Logo, btn } from "@/components/ui";
import { PLANS } from "@/lib/plans";

const steps = [
  {
    n: "1",
    title: "Add your unpaid invoices",
    body: "Type them in, import a CSV, or push them through the API. Takes about two minutes per client.",
  },
  {
    n: "2",
    title: "Paidhound writes the schedule",
    body: "A polite heads-up before the due date, then firm-but-friendly follow-ups at day 7, 14 and 21 — from your business name.",
  },
  {
    n: "3",
    title: "You just watch replies come in",
    body: "When a customer answers, chasing pauses automatically and you get notified. Mark it paid and everything stops instantly.",
  },
];

const features = [
  ["Escalating sequences", "Five professionally-written emails that escalate in tone — friendly to firm — without ever burning the relationship."],
  ["Reply detection", "Customers who reply get automatically snoozed. No robotic double-texting while someone says \"check is in the mail.\""],
  ["Payment links", "Paste a Stripe, PayPal or Wise link once; every reminder carries a one-click pay button. Friction dies, cash flows."],
  ["AR aging dashboard", "See every dollar outstanding, bucketed by age, ranked by which customer to call first."],
  ["Daily digest", "One short email each morning: what was chased, who replied, what got paid."],
  ["Works with any invoicing tool", "QuickBooks, Xero, FreshBooks, Wave, a Google Doc — if you can list an invoice, Paidhound can chase it."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-neutral-600 hover:text-neutral-900">Pricing</Link>
            <Link href="/login" className="text-neutral-600 hover:text-neutral-900">Log in</Link>
            <Link href="/signup" className={btn.primary}>Start free trial</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                For freelancers, consultants & micro-agencies
              </p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Your invoices should chase themselves.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
                You did the work. Paidhound does the asking — polite, persistent,
                escalating email follow-ups that get you paid days or weeks faster,
                without a single awkward conversation.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={`${btn.primary} px-5 py-2.5`}>
                  Start your free trial →
                </Link>
                <span className="text-sm text-slate-400">14 days of Pro · no card required</span>
              </div>
            </div>

            {/* Sample email */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
              <div className="rounded-xl bg-white p-5 text-neutral-800 shadow-inner">
                <div className="border-b border-neutral-100 pb-3 text-xs text-neutral-500">
                  From: Acme Design Studio &nbsp;·&nbsp; to: client@bigco.com
                </div>
                <div className="pt-3 text-sm font-semibold">Following up on invoice INV-1042 ($3,850)</div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                  Hi Sarah,<br /><br />
                  Invoice INV-1042 for $3,850 was due on June 14, and it looks like it
                  hasn&apos;t come through yet. Could be an oversight, or it might be stuck
                  in approvals — if something&apos;s holding it up, let me know and
                  I&apos;ll help sort it out.<br /><br />
                  You can pay online in under a minute:<br />
                  <span className="text-indigo-600 underline">pay.stripe.com/inv_1042</span><br /><br />
                  — Maya, Acme Design Studio
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">✓ Sent automatically</span>
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">Day 7 of 21</span>
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">Pauses on reply</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-3">
          {[
            ["$17,500", "average owed to a US small business in overdue invoices right now (Intuit, 2025)"],
            ["29%", "of freelance invoices are paid late (Bonsai invoice data)"],
            ["20 days/year", "spent by the average freelancer manually chasing payment (IPSE)"],
          ].map(([v, t]) => (
            <div key={v} className="text-center">
              <div className="text-3xl font-bold text-indigo-600">{v}</div>
              <div className="mt-1 text-sm text-neutral-600">{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Set it up once. It never forgets to follow up.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-neutral-600">
          The reason invoices go unpaid isn&apos;t malice — it&apos;s that following up is
          awkward, easy to forget, and easy to do too gently. Paidhound makes consistency automatic.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border border-neutral-200 p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{s.n}</div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-neutral-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold tracking-tight">Built for one job: getting you paid</h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([t, b]) => (
              <div key={t}>
                <h3 className="font-semibold text-indigo-300">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI math */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">The math is not subtle</h2>
        <div className="mt-8 rounded-2xl border-2 border-indigo-100 bg-indigo-50/60 p-8 text-left">
          <p className="leading-relaxed text-neutral-700">
            If you bill <strong>$60,000/year</strong> and Paidhound shaves even{" "}
            <strong>two weeks</strong> off your average time-to-payment, you hold roughly{" "}
            <strong>$2,300 more cash</strong> at any moment instead of financing your
            clients. That&apos;s what the average freelancer is currently owed:{" "}
            <strong>£5,230</strong>, sitting in other people&apos;s bank accounts.
          </p>
          <p className="mt-4 leading-relaxed text-neutral-700">
            Paidhound costs $19/month and takes 15 minutes to set up.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-neutral-200 bg-neutral-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Simple pricing, priced per invoice chased</h2>
          <p className="mt-3 text-center text-neutral-600">
            Dedicated AR teams cost $260–$900+/month. Paidhound starts at $19.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {Object.values(PLANS).map((p) => (
              <div key={p.id} className={`flex flex-col rounded-xl border bg-white p-6 ${p.id === "pro" ? "border-indigo-600 ring-2 ring-indigo-600" : "border-neutral-200"}`}>
                {p.id === "pro" && (
                  <span className="mb-2 inline-flex w-fit rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Most popular</span>
                )}
                <h3 className="font-semibold">{p.name}</h3>
                <div className="mt-2 text-3xl font-bold">
                  ${p.priceMonthly}
                  <span className="text-sm font-normal text-neutral-500">/mo</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                  <li>✓ {p.maxActiveInvoices} active invoices</li>
                  {p.customTemplates && <li>✓ Custom email sequences</li>}
                  {p.csvImport && <li>✓ CSV import</li>}
                  {p.apiAccess && <li>✓ API access</li>}
                  {p.removeBranding && <li>✓ White-label (no footer)</li>}
                  {!p.customTemplates && <li className="text-neutral-400">Default sequence only</li>}
                </ul>
                <Link href="/signup" className={`mt-6 ${p.id === "pro" ? btn.primary : btn.secondary}`}>
                  Start free
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Objection handling */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">&ldquo;Won&apos;t it annoy my clients?&rdquo;</h2>
        <div className="mt-8 space-y-6 text-neutral-700">
          <p>
            <strong>No — because it escalates like a professional would.</strong> The first
            email lands before the due date and reads like a courtesy note. Firmness only
            arrives gradually, and everything pauses the moment your customer replies.
            Consistent reminders are what large companies do to everyone; small suppliers
            stay quiet and get paid last.
          </p>
          <p>
            <strong>You stay in control.</strong> Pause any invoice with one click, edit
            every word of every template, CC yourself on everything, and stop chasing
            anyone instantly.
          </p>
        </div>
        <div className="mt-10 text-center">
          <Link href="/signup" className={`${btn.primary} px-6 py-3 text-base`}>
            Get paid faster — start today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-neutral-500 sm:flex-row">
          <Logo />
          <span>© {new Date().getFullYear()} Paidhound. Stop chasing, start getting paid.</span>
        </div>
      </footer>
    </div>
  );
}
