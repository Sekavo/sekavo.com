"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eyebrow, Field, btn, cn, input, textarea } from "./ui";

interface Props {
  initial: { businessName: string; senderName: string; signature: string; email: string };
  defaults: { issued: string; due: string };
}

const STEPS = ["Your business", "First invoice", "You're set"] as const;

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={cn(
            "flex h-5 items-center rounded-full px-2 text-[11px] font-semibold",
            i === step ? "bg-ink text-white" : i < step ? "bg-pine-100 text-pine-800" : "bg-paper-sunken text-ink-faint"
          )}
        >
          {i + 1}. {s}
        </span>
      ))}
    </div>
  );
}

export function OnboardingWizard({ initial, defaults }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 1 state
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [signature, setSignature] = useState(initial.signature);

  // step 3 confirmation info
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);

  async function saveIdentity(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        senderName,
        signature,
        senderEmail: initial.email,
        onboardingDone: true,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not save.");
      return;
    }
    setStep(1);
  }

  return (
    <div>
      <Eyebrow className="mb-2">Get started</Eyebrow>
      <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.01em]">
        Two minutes to your first automated chase.
      </h1>

      <div className="mt-6">
        <StepDots step={step} />
      </div>

      {step === 0 && (
        <form onSubmit={saveIdentity} className="mt-8 border border-line bg-white p-6">
          <p className="text-sm leading-relaxed text-ink-soft">
            Chase emails are signed with your details. You can change every word later.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="ob-biz">
              <input id="ob-biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120} className={input} placeholder="Acme Design Studio" />
            </Field>
            <Field label="Sender name" htmlFor="ob-name">
              <input id="ob-name" value={senderName} onChange={(e) => setSenderName(e.target.value)} required maxLength={120} className={input} placeholder="Maya Chen" />
            </Field>
            <Field label="Signature · optional" htmlFor="ob-sig" className="sm:col-span-2" hint="Appears at the bottom of every chase email.">
              <textarea id="ob-sig" value={signature} onChange={(e) => setSignature(e.target.value)} rows={2} maxLength={1000} className={textarea} placeholder={"— Maya\nAcme Design Studio"} />
            </Field>
          </div>
          {error && <p className="mt-4 text-sm text-overdue">{error}</p>}
          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={busy || !senderName} className={btn.primary}>
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        </form>
      )}

      {step === 1 && (
        <form
          className="mt-8 border border-line bg-white p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const fd = new FormData(e.currentTarget);
            const res = await fetch("/api/invoices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerName: String(fd.get("customerName") ?? ""),
                customerEmail: String(fd.get("customerEmail") ?? ""),
                number: String(fd.get("number") ?? ""),
                amountCents: Math.round(parseFloat(String(fd.get("amount") || "0")) * 100),
                currency: String(fd.get("currency") || "USD").toUpperCase(),
                issuedAt: new Date(String(fd.get("issuedAt"))).toISOString(),
                dueAt: new Date(String(fd.get("dueAt"))).toISOString(),
                paymentUrl: "",
              }),
            });
            const data = await res.json().catch(() => ({}));
            setBusy(false);
            if (!res.ok) {
              setError(data.error ?? "Could not add the invoice.");
              return;
            }
            setInvoiceNumber(data.invoice?.number ?? "");
            setStep(2);
          }}
        >
          <p className="text-sm leading-relaxed text-ink-soft">
            Add one real invoice you&apos;re waiting on. Sekavo schedules the full sequence immediately — you can pause it any time.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" htmlFor="ob-cname">
              <input id="ob-cname" name="customerName" required maxLength={120} className={input} placeholder="BigCo Inc." />
            </Field>
            <Field label="Customer email" htmlFor="ob-cemail">
              <input id="ob-cemail" name="customerEmail" type="email" required maxLength={200} className={input} placeholder="ap@bigco.com" />
            </Field>
            <Field label="Invoice number" htmlFor="ob-invnum">
              <input id="ob-invnum" name="number" required maxLength={40} className={cn(input, "font-mono")} placeholder="INV-1043" />
            </Field>
            <Field label="Amount" htmlFor="ob-amount">
              <input id="ob-amount" name="amount" type="number" step="0.01" min="0.01" required className={cn(input, "tnum")} placeholder="3850.00" />
            </Field>
            <Field label="Issue date" htmlFor="ob-issued">
              <input id="ob-issued" name="issuedAt" type="date" required defaultValue={defaults.issued} className={cn(input, "tnum")} />
            </Field>
            <Field label="Due date" htmlFor="ob-due" hint="Already overdue? One catch-up email goes out in about an hour.">
              <input id="ob-due" name="dueAt" type="date" required defaultValue={defaults.due} className={cn(input, "tnum")} />
            </Field>
            <input type="hidden" name="currency" value="USD" />
          </div>
          {error && <p className="mt-4 text-sm text-overdue">{error}</p>}
          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={() => setStep(0)} className={btn.ghost}>← Back</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className={btn.secondary}>Skip for now</button>
              <button type="submit" disabled={busy} className={btn.primary}>
                {busy ? "Scheduling…" : "Schedule the chase"}
              </button>
            </div>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="mt-8 border border-line bg-white p-6">
          <p className="font-display text-lg font-semibold">
            {invoiceNumber ? (
              <>Chase scheduled for <span className="font-mono text-[16px]">{invoiceNumber}</span>.</>
            ) : (
              <>Setup complete.</>
            )}
          </p>
          <ul className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
            <li><strong className="font-medium text-ink">What happens next</strong> — reminders go out on schedule from your name; nothing sends without a preview being available first.</li>
            <li><strong className="font-medium text-ink">When a customer replies</strong> — chasing pauses automatically and the reply lands in your activity log.</li>
            <li><strong className="font-medium text-ink">When you get paid</strong> — mark it paid in one click; all remaining emails cancel instantly.</li>
          </ul>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => router.push("/app/sequences")}
              className={btn.secondary}
            >
              Review the sequence
            </button>
            <button
              onClick={() => {
                router.push("/app");
                router.refresh();
              }}
              className={btn.primary}
            >
              Go to dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
