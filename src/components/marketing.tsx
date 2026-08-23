import Link from "next/link";
import { Wordmark } from "./ui";

export function MarketingHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/#how" className="hidden text-ink-soft hover:text-ink sm:block">How it works</Link>
          <Link href="/pricing" className="text-ink-soft hover:text-ink">Pricing</Link>
          <Link href="/login" className="text-ink-soft hover:text-ink">Log in</Link>
          <Link href="/signup" className="bg-pine-700 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-pine-800">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              Automated invoice chasing for independent professionals. Polite where it counts, firm when it matters.
            </p>
          </div>
          <div className="flex gap-16 text-[13px]">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Product</p>
              <ul className="space-y-1.5 text-ink-soft">
                <li><Link href="/#how" className="hover:text-ink">How it works</Link></li>
                <li><Link href="/pricing" className="hover:text-ink">Pricing</Link></li>
                <li><Link href="/signup" className="hover:text-ink">Start free trial</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Company</p>
              <ul className="space-y-1.5 text-ink-soft">
                <li><Link href="/login" className="hover:text-ink">Log in</Link></li>
                <li><a href="mailto:support@paidhound.com" className="hover:text-ink">Support</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-line pt-5 text-xs text-ink-faint">
          © {new Date().getFullYear()} Paidhound. Late payments are a choice your customers make; chasing them needn&apos;t be yours.
        </div>
      </div>
    </footer>
  );
}
