import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { parseSequence } from "@/lib/email/templates";
import { SettingsForms } from "@/components/settings-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const plan = effectivePlan(
    (user.subscription?.plan as never) ?? "free",
    user.subscription?.status ?? "active",
    user.trialEndsAt
  );

  const inboundDomain = process.env.INBOUND_DOMAIN || "inbox.paidhound.com";
  const replyAddress = `reply+${user.id}@${inboundDomain}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500">Your chase identity and sequence. Changes apply to future emails only.</p>
      </div>
      <SettingsForms
        initial={{
          senderName: user.settings?.senderName ?? user.name,
          senderEmail: user.settings?.senderEmail ?? user.email,
          replyTo: user.settings?.replyTo ?? null,
          ccOwner: user.settings?.ccOwner ?? false,
          signature: user.settings?.signature ?? "",
          businessName: user.settings?.businessName ?? "",
          lateFeePolicy: user.settings?.lateFeePolicy ?? "",
          sequence: parseSequence(user.settings?.sequence ?? ""),
          catchUpOnLate: user.settings?.catchUpOnLate ?? true,
          pauseOnReplyDays: user.settings?.pauseOnReplyDays ?? 3,
        }}
        canEditSequence={plan.customTemplates}
        replyAddress={replyAddress}
      />
    </div>
  );
}
