"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, input, label } from "@/components/ui";

function todayISO(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

export function NewInvoiceForm({ defaultNewOpen }: { defaultNewOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultNewOpen));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUpgradeMsg(false);
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
      setUpgradeMsg(Boolean(data.upgradeRequired));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btn.primary}>
        + Add invoice
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Add an invoice to chase</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={label} htmlFor="customerName">Customer name</label>
          <input id="customerName" name="customerName" required className={input} placeholder="BigCo Inc." />
        </div>
        <div>
          <label className={label} htmlFor="customerEmail">Customer email</label>
          <input id="customerEmail" name="customerEmail" type="email" required className={input} placeholder="ap@bigco.com" />
        </div>
        <div>
          <label className={label} htmlFor="number">Invoice number</label>
          <input id="number" name="number" required className={input} placeholder="INV-1043" />
        </div>
        <div>
          <label className={label} htmlFor="amount">Amount</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0.01" required className={input} placeholder="3850.00" />
        </div>
        <div>
          <label className={label} htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue="USD" className={input}>
            {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="paymentUrl">Payment link <span className="text-neutral-400">(optional)</span></label>
          <input id="paymentUrl" name="paymentUrl" type="url" className={input} placeholder="https://pay.stripe.com/..." />
        </div>
        <div>
          <label className={label} htmlFor="issuedAt">Issued</label>
          <input id="issuedAt" name="issuedAt" type="date" required defaultValue={todayISO(-14)} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="dueAt">Due</label>
          <input id="dueAt" name="dueAt" type="date" required defaultValue={todayISO(16)} className={input} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" disabled={busy} className={`${btn.primary} flex-1`}>
            {busy ? "Saving…" : "Start chasing"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
        </div>
      </form>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}{" "}
          {upgradeMsg && <a href="/app/billing" className="font-semibold underline">See plans →</a>}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        Paidhound schedules: heads-up 3 days before due, a note on the due date, then follow-ups at +7/+14/+21 days. Adjust anytime in Settings.
      </p>
    </div>
  );
}
