"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btn, cn, input, Surface } from "./ui";
import { PLANS, type PlanId } from "@/lib/plans";

export function PlanTable({
  currentPlan,
  billingEnabled = true,
}: {
  currentPlan: string;
  billingEnabled?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: PlanId) {
    if (!billingEnabled) {
      setError("Checkout isn't configured on this deployment yet.");
      return;
    }
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
      setError(data.error ?? "Could not open the billing portal.");
      return;
    }
    if (data.url) window.location.assign(data.url);
  }

  return (
    <div>
      <Surface className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-line-strong bg-paper-sunken/60">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Plan</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Price</th>
              <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Active invoices</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Included</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {Object.values(PLANS).map((p) => {
              const isCurrent = p.id === currentPlan;
              return (
                <tr key={p.id} className={cn("border-b border-line last:border-b-0", isCurrent && "bg-pine-50/60")}>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold text-ink">{p.name}</span>
                    <span className="block text-xs text-ink-soft">{p.tagline}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="tnum text-sm font-semibold">{p.priceMonthly === 0 ? "$0" : `$${p.priceMonthly}`}</span>
                    <span className="text-xs text-ink-faint">/mo</span>
                  </td>
                  <td className="tnum px-4 py-3.5 text-center text-sm">{p.maxActiveInvoices}</td>
                  <td className="px-4 py-3.5">
                    <ul className="space-y-0.5 text-xs leading-relaxed text-ink-soft">
                      <li>Escalating sequences · reply detection · payment links</li>
                      {p.customTemplates && <li>Custom sequence editor</li>}
                      {p.csvImport && <li>CSV import</li>}
                      {p.apiAccess && <li>REST API</li>}
                      {p.removeBranding && <li>White-label — no Paidhound footer</li>}
                    </ul>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pine-700">
                        <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-pine-600" /> Current plan
                      </span>
                    ) : p.id === "free" ? (
                      <button onClick={portal} disabled={busy !== null} className={`${btn.secondary} h-8 px-3 text-[13px]`}>
                        Downgrade via Stripe
                      </button>
                    ) : (
                      <button
                        onClick={() => checkout(p.id)}
                        disabled={busy !== null}
                        className={cn("h-8 px-3 text-[13px]", currentPlan === "free" ? btn.primary : btn.secondary)}
                      >
                        {busy === p.id ? "…" : `Switch to ${p.name}`}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Surface>

      {(currentPlan === "starter" || currentPlan === "pro" || currentPlan === "agency") && (
        <button onClick={portal} disabled={busy === "portal"} className={`${btn.secondary} mt-4`}>
          Manage subscription in Stripe
        </button>
      )}
      {error && <p className="mt-3 border border-overdue/30 bg-overdue-bg px-3 py-2 text-sm text-overdue">{error}</p>}
    </div>
  );
}

export function ApiKeysSection({ initialKeys }: { initialKeys: Array<{ id: string; name: string; prefix: string; createdAt: string }> }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
      setError(data.error ?? "Could not create a key.");
      return;
    }
    setSecret(data.secret);
    setKeys((prev) => [{ id: data.key.id, name: data.key.name, prefix: data.secret.slice(0, 11) + "…", createdAt: data.key.createdAt }, ...prev]);
    setName("");
    router.refresh();
  }

  async function revoke(id: string) {
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
    router.refresh();
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">API keys</h2>
        <code className="hidden border border-line bg-white px-2 py-1 font-mono text-[11px] text-ink-soft sm:block">
          POST /api/v1/invoices
        </code>
      </div>

      <div className="flex max-w-xl gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name — e.g. zapier"
          maxLength={60}
          className={input}
        />
        <button onClick={createKey} className={btn.secondary}>Create key</button>
      </div>

      {secret && (
        <div className="mt-3 border border-pine-200 bg-pine-50 px-4 py-3">
          <p className="text-[13px] font-medium text-pine-900">Copy this key now — it is shown once and stored only as a hash.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate border border-pine-200 bg-white px-2 py-1.5 font-mono text-xs">{secret}</code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
              className={`${btn.secondary} h-8 shrink-0 px-3 text-[13px]`}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-overdue">{error}</p>}

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-4 py-2.5">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{k.name}</span>
              <span className="ml-2 font-mono text-xs text-ink-faint">{k.prefix}</span>
              <span className="ml-2 text-xs text-ink-faint">created {new Date(k.createdAt).toLocaleDateString()}</span>
            </span>
            <button onClick={() => revoke(k.id)} className="shrink-0 text-xs font-medium text-overdue hover:underline">
              Revoke
            </button>
          </li>
        ))}
        {keys.length === 0 && <li className="py-3 text-sm text-ink-faint">No API keys yet.</li>}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        Push invoices straight from your own systems with a Bearer header. Requires Pro or above.
      </p>
    </section>
  );
}
