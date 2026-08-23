"use client";

import Link from "next/link";
import { btn } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-overdue">Something broke</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">This page failed to load.</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        The error has been logged. Your scheduled chases keep running in the background regardless.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className={btn.primary}>Try again</button>
        <Link href="/app" className={btn.secondary}>Back to dashboard</Link>
      </div>
    </div>
  );
}
