"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, cn, input, labelText } from "./ui";

export function InvoiceActions({
  invoiceId,
  status,
  chasingEnabled,
}: {
  invoiceId: string;
  status: string;
  chasingEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function patch(data: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Action failed.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function clone() {
    setBusy("clone");
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: "POST" });
    setBusy(null);
    if (res.ok) {
      router.push("/app/invoices");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not clone.");
    }
  }

  async function remove() {
    setBusy("delete");
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/app/invoices");
      router.refresh();
    } else {
      setBusy(null);
      setError("Could not delete.");
    }
  }

  const isActive = status === "active";

  if (editing) {
    return (
      <form
        className="w-full max-w-sm space-y-3 border border-line bg-white p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const ok = await patch(
            {
              amountCents: Math.round(parseFloat(String(fd.get("amount") || "0")) * 100),
              dueAt: new Date(String(fd.get("dueAt"))).toISOString(),
              paymentUrl: String(fd.get("paymentUrl") || ""),
            },
            "edit"
          );
          if (ok) setEditing(false);
        }}
      >
        <p className="text-[13px] font-semibold">Edit invoice</p>
        <div>
          <label htmlFor="ea-amount" className={labelText}>Amount</label>
          <input id="ea-amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="3850.00" className={input} />
        </div>
        <div>
          <label htmlFor="ea-due" className={labelText}>Due date</label>
          <input id="ea-due" name="dueAt" type="date" required className={input} />
        </div>
        <div>
          <label htmlFor="ea-url" className={labelText}>Payment link</label>
          <input id="ea-url" name="paymentUrl" type="url" defaultValue="" placeholder="https://…" className={input} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={busy !== null} className={`${btn.primary} h-8 px-3 text-[13px]`}>
            {busy === "edit" ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className={`${btn.ghost} h-8`}>Cancel</button>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Changing the due date re-anchors every remaining chase step.
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isActive && (
          <button onClick={() => patch({ status: "paid" }, "paid")} disabled={busy !== null} className={`${btn.primary} h-8 px-3 text-[13px]`}>
            Mark paid
          </button>
        )}
        {status === "paid" && (
          <button onClick={() => patch({ status: "active" }, "reopen")} disabled={busy !== null} className={`${btn.secondary} h-8 px-3 text-[13px]`}>
            Reopen chase
          </button>
        )}
        {isActive && chasingEnabled && (
          <button
            onClick={() => patch({ chasingEnabled: false }, "pause")}
            disabled={busy !== null}
            className={`${btn.secondary} h-8 px-3 text-[13px]`}
            title="Stop all scheduled emails for this invoice"
          >
            Pause chasing
          </button>
        )}
        {isActive && !chasingEnabled && (
          <button onClick={() => patch({ chasingEnabled: true }, "resume")} disabled={busy !== null} className={`${btn.primary} h-8 px-3 text-[13px]`}>
            Resume chasing
          </button>
        )}
        <button onClick={() => setEditing(true)} disabled={busy !== null} className={`${btn.secondary} h-8 px-3 text-[13px]`}>
          Edit
        </button>
        <button
          onClick={clone}
          disabled={busy !== null}
          className={`${btn.secondary} h-8 px-3 text-[13px]`}
          title="Copy this invoice with a new due date 30 days out — for recurring billing"
        >
          Clone next month
        </button>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== null}
            className="h-8 px-2 text-[13px] font-medium text-overdue hover:underline disabled:opacity-45"
          >
            Delete
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 border border-overdue/30 bg-overdue-bg px-2 py-1 text-xs text-overdue">
            Delete everything?
            <button onClick={remove} disabled={busy !== null} className="font-semibold underline">
              Yes
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-ink-soft hover:text-ink">
              No
            </button>
          </span>
        )}
      </div>
      {error && (
        <p className={cn("text-right text-xs text-overdue")}>{error}</p>
      )}
    </div>
  );
}
