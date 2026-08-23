"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark, cn } from "./ui";

export interface ChromeUser {
  name: string;
  email: string;
  isAdmin: boolean;
  planName: string;
  trialing: boolean;
  trialDaysLeft: number;
  onboardingDone: boolean;
}

const NAV: Array<{ section: string; items: Array<{ href: string; label: string }> }> = [
  {
    section: "Overview",
    items: [{ href: "/app", label: "Dashboard" }],
  },
  {
    section: "Receivables",
    items: [
      { href: "/app/invoices", label: "Invoices" },
      { href: "/app/customers", label: "Customers" },
    ],
  },
  {
    section: "Automation",
    items: [
      { href: "/app/sequences", label: "Chase sequences" },
      { href: "/app/activity", label: "Activity" },
    ],
  },
  {
    section: "Account",
    items: [
      { href: "/app/settings", label: "Settings" },
      { href: "/app/billing", label: "Billing & API" },
    ],
  },
];

function NavLink({ href, label, onNavigate }: { href: string; label: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "-mx-2 flex items-center justify-between px-2 py-[7px] text-sm transition-colors duration-75",
        active ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"
      )}
    >
      <span className="flex items-center gap-2">
        {active && <span aria-hidden className="h-3.5 w-[3px] bg-pine-600" />}
        <span className={active ? "" : "pl-[11px]"}>{label}</span>
      </span>
    </Link>
  );
}

function PlanBox({ user }: { user: ChromeUser }) {
  if (user.trialing) {
    return (
      <div className="border border-line bg-paper-sunken px-3 py-2.5">
        <p className="text-xs font-semibold text-ink">{user.trialDaysLeft <= 1 ? "Last day of trial" : `${user.trialDaysLeft} days of Pro left`}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">Keep custom sequences and white-label emails.</p>
        <Link href="/app/billing" className="mt-1.5 inline-block text-xs font-semibold text-pine-700 hover:underline">
          Choose a plan →
        </Link>
      </div>
    );
  }
  return (
    <div className="border border-line bg-paper-sunken px-3 py-2.5">
      <p className="text-xs font-semibold text-ink">{user.planName} plan</p>
      <Link href="/app/billing" className="mt-0.5 inline-block text-[11px] text-ink-soft hover:text-ink hover:underline">
        Manage billing →
      </Link>
    </div>
  );
}

function SidebarContent({ user, onNavigate }: { user: ChromeUser; onNavigate?: () => void }) {
  const router = useRouter();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Wordmark href="/app" />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-faint">{group.section}</p>
            <div>
              {group.items.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} onNavigate={onNavigate} />
              ))}
              {group.section === "Account" && user.isAdmin && (
                <NavLink href="/app/admin" label="Admin" onNavigate={onNavigate} />
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-line px-5 py-4">
        <PlanBox user={user} />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink">{user.name}</p>
            <p className="truncate text-[11px] text-ink-faint">{user.email}</p>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/");
              router.refresh();
            }}
            className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: ChromeUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const showOnboarding = !user.onboardingDone;

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-line bg-white lg:block">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Wordmark href="/app" className="text-[19px]" />
        <button
          onClick={() => setOpen(true)}
          className="-mr-2 flex h-9 w-9 items-center justify-center text-ink-soft hover:text-ink"
          aria-label="Open navigation"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40" />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-line bg-white shadow-xl">
            <SidebarContent user={user} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        {showOnboarding && (
          <div className="border-b border-pine-100 bg-pine-50 px-4 py-2.5 lg:px-10">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 text-sm text-pine-900">
              <span>
                <strong className="font-semibold">Finish setup:</strong> confirm your sender details and add your first invoice.
              </span>
              <Link href="/onboarding" className="font-semibold underline decoration-pine-300 underline-offset-2">
                Continue setup →
              </Link>
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
