import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "@/components/ui";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-6">
          <Wordmark href="/app" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <OnboardingWizard
          initial={{
            businessName: user.settings?.businessName ?? "",
            senderName: user.settings?.senderName ?? user.name,
            signature: user.settings?.signature ?? "",
            email: user.email,
          }}
          defaults={{
            issued: new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10),
            due: new Date(Date.now() + 16 * 86_400_000).toISOString().slice(0, 10),
          }}
        />
      </main>
    </div>
  );
}
