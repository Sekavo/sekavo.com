"use client";


import { useState } from "react";
import { btn, input, Card } from "@/components/ui";
import { PLANS, type PlanId } from "@/lib/plans";

export function PlanButtons({ currentPlan }: { currentPlan: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: PlanId) {
    setBusy(plan);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Could not start checkout.");
      return;
    }
    if (data.url) window.location.assign(data.url);
  }

  async function portal() {
    setBusy("portal");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Could not open billing portal.");
      return;
    }
    if (data.url) window.location.assign(data.url);
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-4">
        {Object.values(PLANS).map((p) => {
          const isCurrent = p.id === currentPlan;
          return (
            <div key={p.id} className={`flex flex-col rounded-xl border bg-white p-5 ${isCurrent ? "border-indigo-600 ring-2 ring-indigo-600" : "border-neutral-200"}`}>
              <h3 className="font-semibold">{p.name}</h3>
              <div className="mt-1 text-2xl font-bold">${p.priceMonthly}<span className="text-sm font-normal text-neutral-500">/mo</span></div>
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-neutral-600">
                <li>{p.maxActiveInvoices} active invoices</li>
                <li>{p.customTemplates ? "✓" : "—"} Custom sequences</li>
                <li>{p.csvImport ? "✓" : "—"} CSV import</li>
                <li>{p.apiAccess ? "✓" : "—"} API access</li>
                <li>{p.removeBranding ? "✓" : "—"} White-label</li>
              </ul>
              <button
                onClick={() => (isCurrent && p.id !== "free" ? portal() : checkout(p.id))}
                disabled={isCurrent || busy !== null || p.id === "free"}
                className={`mt-4 ${isCurrent ? btn.secondary : btn.primary}`}
              >
                {isCurrent ? "Current plan" : busy === p.id ? "Redirecting…" : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {(currentPlan === "starter" || currentPlan === "pro" || currentPlan === "agency") && (
        <button onClick={portal} disabled={busy === "portal"} className={`${btn.secondary} mt-4`}>
          Manage subscription (Stripe portal)
        </button>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {!process.env.NEXT_PUBLIC_BILLING_CONFIGURED && (
        <p className="mt-3 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500">
          Billing is not configured on this deployment. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* env vars to enable checkout. Until then, plans are managed manually.
        </p>
      )}
    </div>
  );
}

export function ApiKeysSection({ initialKeys }: { initialKeys: { id: string; name: string; prefix: string; createdAt: string }[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createKey() {
    setError(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "default" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create key.");
      return;
    }
    setSecret(data.secret);
    setKeys((prev) => [{ id: data.key.id, name: data.key.name, prefix: "ph_live_…", createdAt: data.key.createdAt }, ...prev]);
    setName("");

  }

  async function revoke(id: string) {
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));

  }

  return (
    <Card>
      <h2 className="font-semibold">API keys</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Push invoices from your own systems.{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
          POST /api/v1/invoices · Authorization: Bearer ph_live_…
        </code>
      </p>

      <div className="mt-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. zapier)" className={`${input} max-w-xs`} />
        <button onClick={createKey} className={btn.secondary}>Create key</button>
      </div>

      {secret && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-800">Copy your key now — it will never be shown again:</p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 font-mono text-xs">{secret}</code>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <ul className="mt-4 divide-y divide-neutral-100">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between py-2.5 text-sm">
            <span>
              <span className="font-medium">{k.name}</span>{" "}
              <span className="text-xs text-neutral-400">{k.prefix} · created {new Date(k.createdAt).toLocaleDateString()}</span>
            </span>
            <button onClick={() => revoke(k.id)} className="text-xs font-medium text-red-600 hover:underline">Revoke</button>
          </li>
        ))}
        {keys.length === 0 && <li className="py-3 text-sm text-neutral-400">No API keys yet.</li>}
      </ul>
    </Card>
  );
}
