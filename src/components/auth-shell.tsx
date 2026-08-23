import Link from "next/link";
import { Wordmark } from "./ui";

/** Mini chase-timeline used on auth/marketing surfaces to show the product in one glance. */
export function ChaseTimelineMini({ className = "" }: { className?: string }) {
  const steps = [
    { day: "−3 days", label: "Friendly heads-up", state: "sent", tone: "bg-paid" },
    { day: "Due date", label: "Due today note", state: "sent", tone: "bg-paid" },
    { day: "+7 days", label: "Gentle nudge · payment link attached", state: "live", tone: "border-pine-600" },
    { day: "+14 days", label: "Firm follow-up", state: "queued", tone: "border-line-strong" },
    { day: "+21 days", label: "Final notice", state: "queued", tone: "border-line-strong" },
  ] as const;

  return (
    <div className={className}>
      <ol>
        {steps.map((s, i) => (
          <li key={s.day} className="relative flex gap-3 pb-4 last:pb-0">
            {!((i === steps.length - 1)) && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-white/15" />}
            <span
              aria-hidden
              className={`relative z-10 mt-[3px] h-[11px] w-[11px] shrink-0 rounded-full border-2 bg-pine-950 ${s.tone}`}
            >
              {s.state !== "queued" && <span className={`block h-full w-full rounded-full ${s.state === "sent" ? "bg-paid" : "animate-pulse bg-pine-300"}`} />}
            </span>
            <div className="min-w-0">
              <p className="tnum text-[11px] uppercase tracking-[0.1em] text-pine-200/70">{s.day}</p>
              <p className="text-sm leading-snug text-pine-50/90">{s.label}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-pine-100/60">
        A customer reply pauses the sequence automatically. Marking paid cancels everything instantly.
      </p>
    </div>
  );
}

export function AuthShell({
  children,
  side,
}: {
  children: React.ReactNode;
  side: { title: string; sub: string };
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_46%]">
      {/* Form column */}
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <Wordmark />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </div>
        <p className="text-center text-xs text-ink-faint">
          <Link href="/" className="hover:text-ink hover:underline">← Back to sekavo.com</Link>
        </p>
      </div>

      {/* Product column */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-pine-950 p-10 lg:flex">
        <p className="font-display text-lg italic leading-relaxed text-pine-100/90">{side.title}</p>
        <ChaseTimelineMini />
        <p className="text-sm leading-relaxed text-pine-100/60">{side.sub}</p>
      </aside>
    </div>
  );
}
