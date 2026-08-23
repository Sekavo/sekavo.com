import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { IdentityForm } from "@/components/identity-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="How your chases are signed, how replies are handled, and when automation holds back."
      />
      <IdentityForm
        initial={{
          senderName: user.settings?.senderName ?? user.name,
          senderEmail: user.settings?.senderEmail ?? user.email,
          replyTo: user.settings?.replyTo ?? null,
          ccOwner: user.settings?.ccOwner ?? false,
          signature: user.settings?.signature ?? "",
          businessName: user.settings?.businessName ?? "",
          lateFeePolicy: user.settings?.lateFeePolicy ?? "",
          defaultPaymentUrl: user.settings?.defaultPaymentUrl ?? null,
          catchUpOnLate: user.settings?.catchUpOnLate ?? true,
          pauseOnReplyDays: user.settings?.pauseOnReplyDays ?? 3,
        }}
        replyAddress={process.env.INBOUND_DOMAIN ? `reply+${user.id}@${process.env.INBOUND_DOMAIN}` : ""}
      />
    </div>
  );
}
