"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, input, label, Card } from "@/components/ui";
import type { ChaseStep } from "@/lib/email/templates";

export function SettingsForms({
  initial,
  canEditSequence,
  replyAddress,
}: {
  initial: {
    senderName: string;
    senderEmail: string;
    replyTo: string | null;
    ccOwner: boolean;
    signature: string;
    businessName: string;
    lateFeePolicy: string;
    sequence: ChaseStep[];
    catchUpOnLate: boolean;
    pauseOnReplyDays: number;
  };
  canEditSequence: boolean;
  replyAddress: string;
}) {
  const router = useRouter();
  const [saved1, setSaved1] = useState(false);
  const [saved2, setSaved2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ChaseStep[]>(initial.sequence);

  async function saveIdentity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName: String(fd.get("senderName") ?? ""),
        senderEmail: String(fd.get("senderEmail") ?? ""),
        replyTo: String(fd.get("replyTo") ?? ""),
        ccOwner: fd.get("ccOwner") === "on",
        signature: String(fd.get("signature") ?? ""),
        businessName: String(fd.get("businessName") ?? ""),
        lateFeePolicy: String(fd.get("lateFeePolicy") ?? ""),
        catchUpOnLate: fd.get("catchUpOnLate") === "on",
        pauseOnReplyDays: parseInt(String(fd.get("pauseOnReplyDays") ?? "3"), 10) || 3,
        onboardingDone: true,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Save failed.");
      return;
    }
    setSaved1(true);
    setTimeout(() => setSaved1(false), 2500);
    router.refresh();
  }

  async function saveSequence() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence: steps }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Save failed.");
      return;
    }
    setSaved2(true);
    setTimeout(() => setSaved2(false), 2500);
    router.refresh();
  }

  function updateStep(i: number, patchObj: Partial<ChaseStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patchObj } : s)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold">Sender identity</h2>
        <p className="mt-1 text-sm text-neutral-500">How your chase emails sign off and where replies land.</p>
        <form onSubmit={saveIdentity} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="businessName">Business name</label>
            <input id="businessName" name="businessName" defaultValue={initial.businessName} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="senderName">Sender name</label>
            <input id="senderName" name="senderName" required defaultValue={initial.senderName} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="senderEmail">From email shown to customers</label>
            <input id="senderEmail" name="senderEmail" type="email" required defaultValue={initial.senderEmail} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="replyTo">Fallback reply address <span className="text-neutral-400">(used only if reply capture is off)</span></label>
            <input id="replyTo" name="replyTo" type="email" placeholder="you@yourdomain.com" defaultValue={initial.replyTo ?? ""} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="signature">Signature</label>
            <textarea id="signature" name="signature" rows={2} defaultValue={initial.signature} className={input} placeholder={"— Maya\nAcme Design Studio"} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="lateFeePolicy">Late fee policy sentence (added to overdue chases)</label>
            <input id="lateFeePolicy" name="lateFeePolicy" defaultValue={initial.lateFeePolicy} className={input} placeholder="a 1.5% monthly late fee applies after 30 days past due" />
          </div>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" name="ccOwner" defaultChecked={initial.ccOwner} className="h-4 w-4 rounded border-neutral-300" />
              CC me on every chase
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" name="catchUpOnLate" defaultChecked={initial.catchUpOnLate} className="h-4 w-4 rounded border-neutral-300" />
              Send one catch-up email for invoices added after their due date
            </label>
          </div>
          <div>
            <label className={label} htmlFor="pauseOnReplyDays">When a customer replies, snooze chasing for</label>
            <select id="pauseOnReplyDays" name="pauseOnReplyDays" defaultValue={String(initial.pauseOnReplyDays)} className={input}>
              {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          <div className="flex items-end justify-end gap-3 sm:col-span-2">
            {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
            {saved1 && <p className="text-sm font-medium text-emerald-600">Saved ✓</p>}
            <button type="submit" disabled={busy} className={btn.primary}>{busy ? "Saving…" : "Save settings"}</button>
          </div>
        </form>

        <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
          <strong>Replies:</strong>{" "}
          {replyAddress ? (
            <>
              customers who hit &ldquo;reply&rdquo; write to{" "}
              <code className="rounded bg-white px-1 py-0.5">{replyAddress}</code>. Paidhound detects it,
              pauses this customer&apos;s chases and forwards the message to you — no configuration needed.
            </>
          ) : (
            <>
              reply capture isn&apos;t configured on this deployment yet. Replies currently go to your
              fallback address above and won&apos;t pause chasing automatically.
            </>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Chase sequence</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Day offsets are relative to the invoice due date. Variables: {"{{customer_name}} {{invoice_number}} {{amount}} {{due_date}} {{days_late}} {{pay_link_block}} {{signature}}"}
            </p>
          </div>
          {!canEditSequence && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Custom sequences require Starter+ (trial includes it)</span>
          )}
        </div>

        <div className="mt-4 space-y-4">
          {steps.map((s, i) => (
            <div key={i} className={`rounded-lg border p-4 ${s.offsetDays < 0 ? "border-indigo-100 bg-indigo-50/40" : s.offsetDays >= 14 ? "border-red-100 bg-red-50/40" : "border-neutral-200"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className={label}>Day offset vs due date</label>
                  <input
                    type="number"
                    value={s.offsetDays}
                    min={-60}
                    max={365}
                    onChange={(e) => updateStep(i, { offsetDays: parseInt(e.target.value, 10) || 0 })}
                    disabled={!canEditSequence}
                    className={`${input} w-28`}
                  />
                </div>
                <div className="flex-1">
                  <label className={label}>Label (internal)</label>
                  <input value={s.label} onChange={(e) => updateStep(i, { label: e.target.value })} disabled={!canEditSequence} className={input} />
                </div>
                {steps.length > 1 && canEditSequence && (
                  <button onClick={() => setSteps(steps.filter((_, idx) => idx !== i))} className={`${btn.danger} mt-4`}>Remove</button>
                )}
              </div>
              <div className="mt-3">
                <label className={label}>Subject</label>
                <input value={s.subjectTemplate} onChange={(e) => updateStep(i, { subjectTemplate: e.target.value })} disabled={!canEditSequence} className={input} />
              </div>
              <div className="mt-3">
                <label className={label}>Body</label>
                <textarea value={s.bodyTemplate} onChange={(e) => updateStep(i, { bodyTemplate: e.target.value })} rows={7} disabled={!canEditSequence} className={`${input} font-mono text-xs`} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() =>
              setSteps([
                ...steps,
                {
                  offsetDays: steps[steps.length - 1]?.offsetDays + 7 || 28,
                  label: "New step",
                  subjectTemplate: "Re: invoice {{invoice_number}}",
                  bodyTemplate: `Hi {{customer_name}},\n\nFollowing up again on invoice {{invoice_number}} for {{amount}}.\n\n{{pay_link_block}}\n{{signature}}`,
                },
              ])
            }
            disabled={!canEditSequence}
            className={btn.secondary}
          >
            + Add step
          </button>
          <div className="flex items-center gap-3">
            {saved2 && <p className="text-sm font-medium text-emerald-600">Saved ✓</p>}
            <button onClick={saveSequence} disabled={busy || !canEditSequence} className={btn.primary}>
              {busy ? "Saving…" : "Save sequence"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
