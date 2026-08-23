import Link from "next/link";
import { MarketingHeader, SiteFooter } from "@/components/marketing";
import { ComparisonStrip, PricingTable } from "@/components/pricing-table";
import { ChaseTimelineMini } from "@/components/auth-shell";
import { EmailPreview } from "@/components/email-preview";
import { cn } from "@/components/ui";

/* ---------- small presentational helpers ---------- */

function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-700">{eyebrow}</p>
      <h2 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-[-0.01em] sm:text-[34px]">
        {title}
      </h2>
      {lead && <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{lead}</p>}
    </div>
  );
}

/** The hero mock — Sekavo's chase view rendered as real UI, not a screenshot. */
function HeroMock() {
  return (
    <div className="border border-line-strong bg-white shadow-[0_1px_2px_rgba(20,24,28,0.06),0_12px_32px_-16px_rgba(20,24,28,0.18)]">
      {/* window chrome */}
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <span className="font-mono text-xs text-ink-faint">sekavo · invoices / INV-1042</span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-pine-700">3 chases queued</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px]">
        {/* left: invoice summary + ladder */}
        <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-sm font-semibold">INV-1042</p>
              <p className="text-xs text-ink-faint">Lumen Agency · billing@lumen.example</p>
            </div>
            <p className="tnum font-display text-xl font-semibold">$3,850.00</p>
          </div>

          <ol className="mt-4 space-y-0">
            {[
              { d: "−3 days", label: "Friendly heads-up", state: "sent", when: "Jun 11" },
              { d: "due date", label: "Due-today note", state: "sent", when: "Jun 14" },
              { d: "+7 days", label: "Gentle nudge · pay link attached", state: "live", when: "in 2 days" },
              { d: "+14 days", label: "Firm follow-up", state: "queued", when: "" },
              { d: "+21 days", label: "Final notice", state: "queued", when: "" },
            ].map((s, i, arr) => (
              <li key={s.d} className="relative flex gap-3 pb-3 last:pb-0">
                {i < arr.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-line" />}
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 mt-[3px] h-[11px] w-[11px] shrink-0 rounded-full border-2 bg-white",
                    s.state === "sent" ? "border-paid" : s.state === "live" ? "border-pine-600" : "border-line-strong"
                  )}
                >
                  {s.state === "sent" && <span className="block h-full w-full rounded-full bg-paid" />}
                  {s.state === "live" && <span className="block h-full w-full animate-pulse rounded-full bg-pine-300" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px] leading-snug", s.state === "queued" ? "text-ink-faint" : "text-ink")}>
                    {s.label}
                  </span>
                </span>
                {s.when && (
                  <span className={cn("tnum shrink-0 text-[11px]", s.state === "live" ? "font-semibold text-pine-700" : "text-ink-faint")}>
                    {s.when}
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
            <span className="text-caution">Reply received Jun 15 → paused 3 days</span>
            <span className="text-ink-faint">auto-resume Jun 18</span>
          </div>
        </div>

        {/* right: aging + collected */}
        <div className="bg-paper-sunken/50 p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Aging</p>
          <ul className="mt-2 space-y-2">
            {[["Not yet due", "$5,200", 62], ["1–30 late", "$3,850", 46], ["31–60 late", "$1,900", 23], ["60+ late", "$640", 8]].map(([l, v, w]) => (
              <li key={l as string}>
                <div className="flex justify-between text-[11px] text-ink-soft"><span>{l}</span><span className="tnum">{v}</span></div>
                <div className="mt-1 h-[3px] bg-white"><div className="h-full bg-pine-500/80" style={{ width: `${w}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Collected · 30d</p>
            <p className="tnum mt-1 font-display text-lg font-semibold text-paid">$12,400</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingHeader />

      {/* ---------------- Hero ---------------- */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:py-20">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-pine-700">
              For freelancers · consultants · micro-agencies
            </p>
            <h1 className="mt-3 font-display text-[38px] font-semibold leading-[1.08] tracking-[-0.015em] sm:text-[46px]">
              Get paid without asking twice.
            </h1>
            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-ink-soft">
              Sekavo follows up on your unpaid invoices automatically — polite, escalating sequences
              that pause the moment a customer replies. You did the work; the follow-up happens without you.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/signup" className="bg-pine-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-pine-800">
                Start chasing free →
              </Link>
              <Link href="#how" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink-faint">
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-faint">14-day Pro trial · no card · works alongside QuickBooks, Xero, Wave or plain PDFs</p>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* ---------------- Proof strip ---------------- */}
      <section className="border-b border-line bg-paper-sunken/60">
        <dl className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line px-5 py-8 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
          {[
            ["$17,500", "average owed to a US small business right now in overdue invoices (Intuit, 2025)"],
            ["29%", "of freelance invoices get paid late — and the average freelancer is owed £5,230 at any moment"],
            ["20 days a year", "spent by independent professionals manually asking for money they already earned"],
          ].map(([v, t]) => (
            <div key={v} className="py-4 first:pt-0 last:pb-0 sm:px-8 sm:first:pl-0 sm:last:pr-0">
              <dt className="sr-only">{t}</dt>
              <dd className="flex items-baseline gap-3">
                <span className="tnum shrink-0 font-display text-[26px] font-semibold leading-none">{v}</span>
                <span className="text-xs leading-relaxed text-ink-soft">{t}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------- Problem ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <SectionHead
            eyebrow="The problem"
            title="Invoices don't go unpaid out of malice. They go unpaid out of silence."
            lead="Following up is awkward, easy to postpone, and easy to do too gently. So small suppliers stay quiet — and quietly get paid last."
          />
          <div className="self-end">
            <div className="border-l-2 border-pine-600 pl-5 font-display text-[19px] italic leading-relaxed text-ink">
              &ldquo;The check is in the mail&rdquo; is a cash-flow strategy — just not yours.
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Large companies remind everyone, consistently, in escalating tones, without emotion.
              That consistency is exactly why they get paid first. Sekavo gives you the same
              discipline — written once, running forever, pausing the second a human replies.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <SectionHead
            eyebrow="How it works"
            title="Set the ladder once. It climbs for you."
          />
          <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {[
              ["Add the invoice", "Type it in, import a CSV, or push it through the API. Customer, amount, due date — that's the whole form."],
              ["Sekavo builds the schedule", "A courtesy note three days before due, a word on the day itself, then firm-but-professional follow-ups at +7, +14 and +21."],
              ["You watch replies arrive", "Any customer response pauses their sequence automatically and lands in your activity log. Mark paid — everything cancels instantly."],
            ].map(([title, body], i) => (
              <div key={title} className="border-t-2 border-ink pt-5">
                <p className="tnum font-display text-sm italic text-pine-700">Step {i + 1}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.005em]">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Product showcase: email ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHead
          eyebrow="The emails"
          title="Written like an owner, escalated like a professional."
          lead="No robotic templates, no passive-aggressive ALL CAPS. Five tones that move from courtesy to final notice — each one editable down to the comma."
        />
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <EmailPreview
            tone="plain"
            meta="+7 days after due"
            fromName="Acme Design Studio"
            fromEmail="maya@acmedesign.studio"
            toEmail="billing@bigco.example"
            replyTo="reply+dK9x@inbox.sekavo.com"
            subject={"Following up on invoice INV-1042 ($3,850)"}
            body={`Hi Sarah,

Invoice INV-1042 for $3,850.00 was due on Friday, June 14, and it looks like it hasn't come through yet.

Could be an oversight, or it might be stuck in an approvals queue. If something's holding it up, let me know and I'll help sort it out.

You can pay online in under a minute:
https://buy.stripe.com/demo_1042

— Maya
Acme Design Studio`}
          />
          <div className="space-y-5">
            {[
              ["Payment links do the heavy lifting", "Every reminder carries your Stripe, PayPal or Wise link. Paying you becomes a thirty-second decision instead of an accounts-payable ticket."],
              ["Replies are read, not ignored", "“Payment's coming Friday” pauses the ladder for your chosen grace period, then resumes only if needed. Nobody gets double-texted mid-conversation."],
              ["Late fees, stated calmly", "Your late-payment sentence appears on overdue chases — citing terms reads like process, not anger."],
            ].map(([t, b]) => (
              <div key={t} className="border-t border-line pt-4">
                <h3 className="text-[15px] font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Control ---------------- */}
      <section className="border-y border-line bg-pine-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-300">Control</p>
            <h2 className="mt-2 font-display text-[30px] font-semibold leading-tight sm:text-[34px]">
              Automation with your hand on the brake.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-pine-100/75">
              Every email is previewed before it sends. Every sequence can be paused per invoice,
              edited per word, or stopped entirely. Your customers meet your judgment first — the
              software just never forgets to follow up.
            </p>
            <Link href="/signup" className="mt-7 inline-flex bg-white px-5 py-2.5 text-sm font-medium text-pine-950 hover:bg-pine-100">
              Try it on your worst payer →
            </Link>
          </div>
          <ChaseTimelineMini />
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHead
          eyebrow="Pricing"
          title="Priced by one number: invoices actively chased."
          lead="No seats, no revenue bands, no percentage of what you collect. If an invoice is paid, paused or closed, it stops counting."
        />
        <div className="mt-10">
          <PricingTable cta="signup" />
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <h3 className="text-[15px] font-semibold">How the market prices this job</h3>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-ink-soft">
              Dedicated AR teams are priced for companies with finance departments. The free
              reminders inside accounting tools fire blindly and can&apos;t read a reply.
            </p>
            <ComparisonStrip />
          </div>
          <div className="space-y-5 self-start border-t-2 border-ink pt-5">
            <p className="font-display text-lg italic leading-relaxed">
              &ldquo;Shave two weeks off $60k of annual billing and you hold ~$2,300 more cash all year.&rdquo;
            </p>
            <p className="text-sm leading-relaxed text-ink-soft">
              That working capital costs less than a dinner out per month here. The math isn&apos;t subtle — which is why the trial asks for no card.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="border-t border-line bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center sm:px-8">
          <div>
            <h2 className="font-display text-[26px] font-semibold leading-tight sm:text-[30px]">
              Stop being your own collections department.
            </h2>
            <p className="mt-2 text-[15px] text-white/65">Fifteen minutes of setup. The awkward emails, handled forever.</p>
          </div>
          <Link href="/signup" className="shrink-0 bg-pine-500 px-6 py-3 text-sm font-medium text-white hover:bg-pine-400">
            Start free trial →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
