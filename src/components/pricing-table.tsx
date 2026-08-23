import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { cn } from "./ui";

const FEATURES = (p: (typeof PLANS)[keyof typeof PLANS]) =>
  [
    p.customTemplates ? "Custom sequences & tone" : "Professional default sequence",
    "Reply detection · payment links · daily digest",
    p.csvImport ? "CSV import" : null,
    p.apiAccess ? "REST API" : null,
    p.removeBranding ? "White-label emails" : "Paidhound footer on emails",
  ].filter(Boolean) as string[];

export function PricingTable({ cta }: { cta: "signup" | "choose" }) {
  return (
    <div className="border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-line-strong bg-paper-sunken/60 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              <th className="px-5 py-3 font-semibold">Plan</th>
              <th className="px-5 py-3 text-right font-semibold">Monthly</th>
              <th className="px-5 py-3 text-center font-semibold">Active invoices chased</th>
              <th className="px-5 py-3 font-semibold">Everything included</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {Object.values(PLANS).map((p) => {
              const featured = p.id === "pro";
              return (
                <tr key={p.id} className={cn("border-b border-line last:border-b-0", featured && "bg-pine-50/50")}>
                  <td className="px-5 py-4 align-top">
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="mt-0.5 block max-w-[180px] text-xs leading-relaxed text-ink-soft">{p.tagline}</span>
                  </td>
                  <td className="px-5 py-4 text-right align-top">
                    <span className="tnum font-display text-xl font-semibold">${p.priceMonthly}</span>
                    {p.priceMonthly > 0 && <span className="text-xs text-ink-faint">/mo</span>}
                  </td>
                  <td className="tnum px-5 py-4 text-center align-top text-sm font-medium">
                    {p.maxActiveInvoices}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <ul className="max-w-[300px] space-y-1 text-xs leading-relaxed text-ink-soft">
                      {FEATURES(p).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-5 py-4 align-top text-right">
                    <Link
                      href="/signup"
                      className={cn(
                        "inline-flex h-8 items-center px-3 text-[13px] font-medium",
                        featured ? "bg-pine-700 text-white hover:bg-pine-800" : "border border-line-strong bg-white hover:border-ink-faint"
                      )}
                    >
                      {cta === "signup" ? (featured ? "Start free" : `Start on ${p.name}`) : `Choose ${p.name}`}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-paper-sunken/50 px-5 py-2.5 text-xs text-ink-soft">
        <span>Every plan starts with 14 days of Pro — no card required.</span>
        <span>Paid, paused and closed invoices never count toward your limit.</span>
      </div>
    </div>
  );
}

export function ComparisonStrip() {
  const rows: Array<[string, string, string]> = [
    ["Chaser", "$259+/mo", "Turnover-based tiers, add-ons extra"],
    ["Upflow", "~$440/mo", "Quote-only, annual contracts"],
    ["Paidnice", "$69/mo", "Requires Xero or QuickBooks"],
    ["Native reminders", "Free", "Static schedules, blind to replies"],
    ["Paidhound", "$19–149/mo", "Self-serve, works with anything, reply-aware"],
  ];
  return (
    <div className="border border-line bg-white">
      <table className="w-full">
        <tbody>
          {rows.map(([name, price, note]) => (
            <tr key={name} className={cn("border-b border-line last:border-b-0", name === "Paidhound" && "bg-pine-50/50")}>
              <td className={cn("px-5 py-3 text-sm", name === "Paidhound" ? "font-semibold" : "font-medium")}>
                {name}
                {name === "Paidhound" && (
                  <span aria-hidden className="ml-1.5 inline-block h-[5px] w-[5px] rounded-full bg-pine-600" />
                )}
              </td>
              <td className="tnum w-28 px-5 py-3 text-sm text-ink-soft">{price}</td>
              <td className="hidden w-1/2 px-5 py-3 text-xs leading-relaxed text-ink-faint sm:table-cell">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-5 py-2.5 text-[11px] text-ink-faint">
        Competitor prices from public pages, June 2026.
      </p>
    </div>
  );
}
