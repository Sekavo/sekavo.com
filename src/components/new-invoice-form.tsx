"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, btn, cn, input } from "./ui";

function iso(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function NewInvoiceForm({
  defaultNewOpen,
  defaultPaymentUrl = "",
}: {
  defaultNewOpen?: boolean;
  defaultPaymentUrl?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultNewOpen));
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdNumber, setCreatedNumber] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUpgrade(false);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: String(fd.get("customerName") ?? ""),
        customerEmail: String(fd.get("customerEmail") ?? ""),
        number: String(fd.get("number") ?? ""),
        amountCents: Math.round(parseFloat(String(fd.get("amount") ?? "0")) * 100),
        currency: String(fd.get("currency") ?? "USD").toUpperCase(),
        issuedAt: new Date(String(fd.get("issuedAt"))).toISOString(),
        dueAt: new Date(String(fd.get("dueAt"))).toISOString(),
        paymentUrl: String(fd.get("paymentUrl") ?? ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save invoice.");
      setUpgrade(Boolean(data.upgradeRequired));
      return;
    }
    setCreatedId(data.invoice?.id ?? null);
    setCreatedNumber(data.invoice?.number ?? "");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btn.primary}>
        Add invoice
      </button>
    );
  }

  if (!open && createdId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-pine-200 bg-pine-50 px-4 py-3 text-sm text-pine-900">
        <span>
          <strong className="font-semibold">{createdNumber || "Invoice"} added</strong> — chase sequence scheduled.
        </span>
        <span className="flex items-center gap-4">
          <a href={`/app/invoices/${createdId}`} className="font-semibold underline underline-offset-2">View schedule →</a>
          <button onClick={() => { setCreatedId(null); setOpen(true); }} className="font-medium text-pine-700 hover:underline">Add another</button>
        </span>
      </div>
    );
  }

  return (
    <div className="border border-line bg-white">
      <div className="border-b border-line px-4 py-3">
        <p className="text-[13px] font-semibold">Add an invoice to chase</p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-x-5 gap-y-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Customer name" htmlFor="customerName">
          <input id="customerName" name="customerName" required maxLength={120} className={input} placeholder="BigCo Inc." />
        </Field>
        <Field label="Customer email" htmlFor="customerEmail">
          <input id="customerEmail" name="customerEmail" type="email" required className={input} placeholder="ap@bigco.com" />
        </Field>
        <Field label="Invoice number" htmlFor="number">
          <input id="number" name="number" required maxLength={40} className={cn(input, "font-mono")} placeholder="INV-1043" />
        </Field>
        <Field label="Amount" htmlFor="amount">
          <input id="amount" name="amount" type="number" step="0.01" min="0.01" required className={cn(input, "tnum")} placeholder="3850.00" />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <select id="currency" name="currency" defaultValue="USD" className={input}>
            {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment link · optional" htmlFor="paymentUrl" hint="Added to every reminder as a one-click pay button.">
          <input id="paymentUrl" name="paymentUrl" type="url" defaultValue={defaultPaymentUrl} className={input} placeholder="https://buy.stripe.com/…" />
        </Field>
        <Field label="Issue date" htmlFor="issuedAt">
          <input id="issuedAt" name="issuedAt" type="date" required defaultValue={iso(-14)} className={cn(input, "tnum")} />
        </Field>
        <Field label="Due date" htmlFor="dueAt">
          <input id="dueAt" name="dueAt" type="date" required defaultValue={iso(16)} className={cn(input, "tnum")} />
        </Field>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
          <button type="submit" disabled={busy} className={btn.primary}>
            {busy ? "Scheduling…" : "Schedule chases"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
        </div>
      </form>
      {error && (
        <p className="border-t border-line bg-paper-sunken px-4 py-2.5 text-sm text-overdue">
          {error}
          {upgrade && <a href="/app/billing" className="font-semibold underline"> See plans →</a>}
        </p>
      )}
      <p className="border-t border-line px-4 py-2.5 text-xs leading-relaxed text-ink-faint">
        Sekavo schedules a heads-up 3 days before the due date, a note on the day, then follow-ups at +7 / +14 / +21 days.
        Overdue invoices get one catch-up email in about an hour — pause or edit it before it goes.
      </p>
    </div>
  );
}
