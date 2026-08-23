import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { settingsUpdateSchema } from "@/lib/validation";
import { effectivePlan } from "@/lib/plans";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.settings) return NextResponse.json({ error: "Settings missing" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const d = parsed.data;

  const plan = effectivePlan(
    (user.subscription?.plan as never) ?? "free",
    user.subscription?.status ?? "active",
    user.trialEndsAt
  );
  // Free users keep the default sequence; custom edits require Starter+
  const data: Record<string, unknown> = {};
  for (const k of ["senderName", "senderEmail", "ccOwner", "signature", "businessName", "lateFeePolicy", "catchUpOnLate", "pauseOnReplyDays", "onboardingDone"] as const) {
    if (d[k] !== undefined) data[k] = d[k];
  }
  if (d.replyTo !== undefined) data.replyTo = d.replyTo || null;
  if (d.sequence !== undefined) {
    if (!plan.customTemplates && JSON.stringify(d.sequence) !== user.settings.sequence) {
      return NextResponse.json({ error: "Custom sequences require the Starter plan.", upgradeRequired: true }, { status: 402 });
    }
    data.sequence = JSON.stringify(d.sequence);
  }

  const updated = await db.userSettings.update({ where: { userId: user.id }, data });
  await db.user.update({ where: { id: user.id }, data: { businessName: updated.businessName || null } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
