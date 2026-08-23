"use client";

import Link from "next/link";
import { btn } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        The error has been logged. Your scheduled chases continue running in the background.
      </p>
      <div className="mt-5 flex gap-3">
        <button onClick={reset} className={btn.primary}>Try again</button>
        <Link href="/app" className={btn.secondary}>Back to dashboard</Link>
      </div>
    </div>
  );
}
