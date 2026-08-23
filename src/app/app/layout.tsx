import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan, PLANS } from "@/lib/plans";
import { Logo } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";

type AppLayoutProps = { children: React.ReactNode };

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const trialing = sub?.status === "trialing" && user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
  const daysLeft = trialing && user.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (24 * 3600 * 1000)))
    : 0;

  const nav = [
    ["/app", "Dashboard"],
    ["/app/invoices", "Invoices"],
    ["/app/customers", "Customers"],
    ["/app/settings", "Settings"],
    ["/app/billing", "Billing"],
    ...(user.isAdmin ? [["/app/admin", "Admin"]] : []),
  ] as const;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/app/billing"
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                plan.id !== "free" ? "bg-indigo-50 text-indigo-700" : "bg-neutral-100 text-neutral-600"
              }`}
              title={trialing ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : ""}
            >
              {trialing ? `${PLANS.pro.name} trial · ${daysLeft}d left` : plan.name}
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-neutral-100 px-4 py-2 sm:hidden">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {!user.settings?.onboardingDone && (
        <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2.5 text-center text-sm text-indigo-900">
          👋 Finish setup — confirm your sender identity in{" "}
          <Link href="/app/settings" className="font-semibold underline">Settings</Link>{" "}
          so chases go out under your name.
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
