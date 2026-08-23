"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, input } from "./ui";

export function NoteEditor({ invoiceId, current }: { invoiceId: string; current: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: value.trim() }),
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs font-medium text-pine-700 hover:underline">
        {current ? "Edit note" : "Add note"}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={2000} className={input} />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className={`${btn.secondary} h-8 px-3 text-[13px]`}>
          {busy ? "Saving…" : "Save note"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setValue(current);
          }}
          className={`${btn.ghost} h-8`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
