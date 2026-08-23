import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">404</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">This invoice doesn&apos;t exist — or belongs to another account.</h2>
      <Link href="/app/invoices" className={`${btn.secondary} mt-6`}>Back to invoices</Link>
    </div>
  );
}
