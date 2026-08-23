"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { btn, input } from "@/components/ui";

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
    setMsg(`Imported ${data.imported} invoices${data.skipped ? `, skipped ${data.skipped}` : ""}.${data.errors?.length ? ` Issues: ${data.errors.slice(0, 3).join("; ")}` : ""}`);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={onUpload} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">CSV import</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Columns: <code className="rounded bg-neutral-100 px-1">customer_name</code>,{" "}
        <code className="rounded bg-neutral-100 px-1">customer_email</code>,{" "}
        <code className="rounded bg-neutral-100 px-1">invoice_number</code>,{" "}
        <code className="rounded bg-neutral-100 px-1">amount</code>,{" "}
        <code className="rounded bg-neutral-100 px-1">due_date</code>, optional:{" "}
        <code className="rounded bg-neutral-100 px-1">currency, issue_date, payment_url</code>
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <input ref={fileRef} type="file" accept=".csv,text/csv" required className={`${input} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700`} />
        </div>
        <button type="submit" disabled={busy} className={btn.secondary}>{busy ? "Importing…" : "Import CSV"}</button>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
