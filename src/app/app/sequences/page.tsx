import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";
import { parseSequence } from "@/lib/email/templates";
import { PageHeader } from "@/components/ui";
import { SequenceEditor } from "@/components/sequence-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chase sequences" };

export default async function SequencesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const plan = effectivePlan(
    (user.subscription?.plan as never) ?? "free",
    user.subscription?.status ?? "active",
    user.trialEndsAt
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chase sequences"
        description="The ladder every unpaid invoice climbs — polite first, firmer as it ages. Every email is previewed on the invoice before it goes."
      />
      <SequenceEditor initial={parseSequence(user.settings?.sequence ?? "")} canEdit={plan.customTemplates} />
    </div>
  );
}
