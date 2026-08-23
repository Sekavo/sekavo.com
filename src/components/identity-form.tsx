"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eyebrow, Field, btn, input, textarea } from "./ui";

export interface IdentitySettings {
  senderName: string;
  senderEmail: string;
  replyTo: string | null;
  ccOwner: boolean;
  signature: string;
  businessName: string;
  lateFeePolicy: string;
  defaultPaymentUrl: string | null;
  catchUpOnLate: boolean;
  pauseOnReplyDays: number;
}

export function IdentityForm({
  initial,
  replyAddress,
}: {
  initial: IdentitySettings;
  replyAddress: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
        defaultPaymentUrl: String(fd.get("defaultPaymentUrl") ?? ""),
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
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section>
        <Eyebrow className="mb-3">Sender identity</Eyebrow>
        <div className="border border-line bg-white px-4 py-4">
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="businessName">
              <input id="businessName" name="businessName" maxLength={120} defaultValue={initial.businessName} className={input} placeholder="Acme Design Studio" />
            </Field>
            <Field label="Sender name" htmlFor="senderName">
              <input id="senderName" name="senderName" required maxLength={120} defaultValue={initial.senderName} className={input} placeholder="Maya Chen" />
            </Field>
            <Field
              label="From email shown to customers"
              htmlFor="senderEmail"
            >
              <input id="senderEmail" name="senderEmail" type="email" required maxLength={200} defaultValue={initial.senderEmail} className={input} />
            </Field>
            <Field label="Fallback reply address · optional" htmlFor="replyTo" hint="Used only when reply capture is not configured.">
              <input id="replyTo" name="replyTo" type="email" maxLength={200} placeholder="you@yourdomain.com" defaultValue={initial.replyTo ?? ""} className={input} />
            </Field>
            <Field label="Signature" htmlFor="signature" className="sm:col-span-2">
              <textarea id="signature" name="signature" rows={2} maxLength={1000} defaultValue={initial.signature} className={textarea} placeholder={"— Maya\nAcme Design Studio"} />
            </Field>
            <Field
              label="Default payment link · optional"
              htmlFor="defaultPaymentUrl"
              hint="Pre-filled on every new invoice — e.g. your Stripe payment page."
              className="sm:col-span-2"
            >
              <input id="defaultPaymentUrl" name="defaultPaymentUrl" type="url" maxLength={500} defaultValue={initial.defaultPaymentUrl ?? ""} className={input} placeholder="https://buy.stripe.com/…" />
            </Field>
            <Field
              label="Late-fee sentence"
              htmlFor="lateFeePolicy"
              hint="Appended to overdue chases once past due. Leave empty for none."
              className="sm:col-span-2"
            >
              <input id="lateFeePolicy" name="lateFeePolicy" maxLength={300} defaultValue={initial.lateFeePolicy} className={input} placeholder="a 1.5% monthly late fee applies after 30 days past due" />
            </Field>
          </div>
        </div>
      </section>

      <section>
        <Eyebrow className="mb-3">Automation behavior</Eyebrow>
        <div className="divide-y divide-line border border-line bg-white">
          <label className="flex items-start justify-between gap-6 px-4 py-3.5">
            <span>
              <span className="block text-sm font-medium text-ink">Catch-up email for overdue invoices</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-soft">
                When you add an invoice that is already past due, send one current-state follow-up instead of the full missed ladder.
              </span>
            </span>
            <input type="checkbox" name="catchUpOnLate" defaultChecked={initial.catchUpOnLate} className="mt-1 h-4 w-4 shrink-0 accent-pine-700" />
          </label>
          <div className="flex items-center justify-between gap-6 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">Snooze chasing when a customer replies</p>
              <p className="mt-0.5 max-w-md text-[13px] leading-relaxed text-ink-soft">
                Replies are detected automatically; their open invoices wait this long before any further email.
              </p>
            </div>
            <select name="pauseOnReplyDays" defaultValue={String(initial.pauseOnReplyDays)} className={`${input} w-28 shrink-0`}>
              {[1, 2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>
          <label className="flex items-start justify-between gap-6 px-4 py-3.5">
            <span>
              <span className="block text-sm font-medium text-ink">Copy me on every chase</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-soft">
                Each reminder is CC&apos;d to your account email as it goes out.
              </span>
            </span>
            <input type="checkbox" name="ccOwner" defaultChecked={initial.ccOwner} className="mt-1 h-4 w-4 shrink-0 accent-pine-700" />
          </label>
        </div>

        {replyAddress ? (
          <p className="mt-3 border-l-2 border-pine-300 bg-white px-4 py-2.5 text-[13px] leading-relaxed text-ink-soft">
            Reply capture is active. Customers who hit “reply” write to{" "}
            <code className="bg-paper-sunken px-1 py-0.5 font-mono text-xs">{replyAddress}</code> — Sekavo pauses their chases and forwards the message to your account email.
          </p>
        ) : (
          <p className="mt-3 border-l-2 border-line-strong bg-white px-4 py-2.5 text-[13px] leading-relaxed text-ink-faint">
            Reply capture isn&apos;t configured on this deployment — replies go to your fallback address above and won&apos;t pause chasing automatically.
          </p>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        {error && <p className="text-sm text-overdue">{error}</p>}
        {saved && <p className="text-sm font-medium text-paid">Saved</p>}
        <button type="submit" disabled={busy} className={btn.primary}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
