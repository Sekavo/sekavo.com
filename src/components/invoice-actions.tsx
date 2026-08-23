"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, input, label } from "@/components/ui";

export function InvoiceActions({
  invoiceId,
  status,
  chasingEnabled,
  paymentUrl,
}: {
  invoiceId: string;
  status: string;
  chasingEnabled: boolean;
  paymentUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");

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
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this invoice and all its scheduled chases? This cannot be undone.")) return;
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

  async function addNote() {
    if (!note.trim()) return;
    setBusy("note");
    await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: note.trim() }),
    });
    setBusy(null);
    setNote("");
    router.refresh();
  }

  if (editing) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          patch(
            {
              amountCents: Math.round(parseFloat(String(fd.get("amount") || "0")) * 100),
              dueAt: new Date(String(fd.get("dueAt"))).toISOString(),
              paymentUrl: String(fd.get("paymentUrl") || ""),
            },
            "edit"
          ).then(() => setEditing(false));
        }}
      >
        <div>
          <label className={label}>Amount</label>
          <input name="amount" type="number" step="0.01" defaultValue="" className={input} placeholder="New amount" required />
        </div>
        <div>
          <label className={label}>Due date</label>
          <input name="dueAt" type="date" className={input} required />
        </div>
        <div>
          <label className={label}>Payment link</label>
          <input name="paymentUrl" type="url" defaultValue={paymentUrl ?? ""} className={input} placeholder="https://..." />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy !== null} className={btn.primary}>{busy === "edit" ? "Saving…" : "Save changes"}</button>
          <button type="button" onClick={() => setEditing(false)} className={btn.secondary}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status !== "paid" && (
          <button onClick={() => patch({ status: "paid" }, "paid")} disabled={busy !== null} className={btn.primary}>
            ✓ Mark paid
          </button>
        )}
        {status === "paid" && (
          <button onClick={() => patch({ status: "active" }, "reopen")} disabled={busy !== null} className={btn.secondary}>
            Reopen chase
          </button>
        )}
        {status === "active" && chasingEnabled && (
          <button onClick={() => patch({ chasingEnabled: false }, "pause")} disabled={busy !== null} className={btn.secondary}>
            ⏸ Pause chasing
          </button>
        )}
        {status === "active" && !chasingEnabled && (
          <button onClick={() => patch({ chasingEnabled: true }, "resume")} disabled={busy !== null} className={btn.primary}>
            ▶ Resume chasing
          </button>
        )}
        <button onClick={() => setEditing(true)} className={btn.secondary}>Edit</button>
        <button onClick={remove} disabled={busy !== null} className={btn.danger}>Delete</button>
      </div>

      <div className="border-t border-neutral-100 pt-3">
        <label className={label}>Add a private note</label>
        <div className="flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={input} placeholder='"Client said check is cut on the 30th"' />
          <button onClick={addNote} disabled={busy !== null || !note.trim()} className={btn.secondary}>Add</button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
