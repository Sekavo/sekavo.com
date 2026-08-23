"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btn } from "./ui";

const COLUMNS = ["customer_name", "customer_email", "invoice_number", "amount", "due_date"];

export function CsvImport() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const text = await file.text();
    const res = await fetch("/api/invoices/import", { method: "POST", body: text });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed.");
      return;
    }
    setMsg(
      `Imported ${data.imported} invoice${data.imported === 1 ? "" : "s"}${data.skipped ? `, skipped ${data.skipped}` : ""}.` +
        (data.errors?.length ? ` Issues: ${data.errors.slice(0, 3).join("; ")}` : "")
    );
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={onUpload} className="border border-line bg-white">
      <div className="px-4 py-4">
        <p className="text-[13px] leading-relaxed text-ink-soft">
          Required columns:{" "}
          {COLUMNS.map((c) => (
            <code key={c} className="mr-1 inline-block border border-line bg-paper-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink">
              {c}
            </code>
          ))}{" "}
          — optional: <code className="border border-line bg-paper-sunken px-1.5 py-0.5 font-mono text-[11px]">currency</code>,{" "}
          <code className="border border-line bg-paper-sunken px-1.5 py-0.5 font-mono text-[11px]">issue_date</code>,{" "}
          <code className="border border-line bg-paper-sunken px-1.5 py-0.5 font-mono text-[11px]">payment_url</code>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            required
            className="max-w-sm border border-line-strong bg-white px-2 py-1.5 text-xs file:mr-3 file:h-6 file:border-0 file:border-r file:border-line file:bg-transparent file:pr-3 file:text-xs file:font-medium file:text-pine-700"
          />
          <button type="submit" disabled={busy} className={`${btn.secondary} h-8 px-3 text-[13px]`}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
      {(msg || error) && (
        <p className={`border-t border-line px-4 py-2.5 text-sm ${error ? "bg-overdue-bg text-overdue" : "bg-paid-bg text-paid"}`}>
          {error ?? msg}
        </p>
      )}
    </form>
  );
}
