import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan, PLANS } from "@/lib/plans";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sub = user.subscription;
  const plan = effectivePlan((sub?.plan as never) ?? "free", sub?.status ?? "active", user.trialEndsAt);
  const trialing = Boolean(sub?.status === "trialing" && user.trialEndsAt && new Date(user.trialEndsAt) > new Date());
  const trialDaysLeft = trialing && user.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (24 * 3600 * 1000)))
    : 0;

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        planName: trialing ? `Pro trial · ${PLANS.pro.name}` : plan.name,
        trialing,
        trialDaysLeft,
        onboardingDone: user.settings?.onboardingDone ?? false,
      }}
    >
      {children}
    </AppShell>
  );
}
