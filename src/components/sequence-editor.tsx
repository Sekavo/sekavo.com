"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChaseStep } from "@/lib/email/templates";
import { Eyebrow, Field, btn, cn, input, textarea } from "./ui";

const TONE_BY_OFFSET = (d: number) => (d < 0 ? "Courtesy" : d <= 3 ? "Neutral" : d <= 10 ? "Firm" : "Final");

export function SequenceEditor({
  initial,
  canEdit,
}: {
  initial: ChaseStep[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<ChaseStep[]>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<ChaseStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence: steps }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Save failed.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  const sortedIdx = steps.map((_, i) => i).sort((a, b) => steps[a].offsetDays - steps[b].offsetDays);

  return (
    <div className="space-y-6">
      {/* Ladder visualization */}
      <section>
        <Eyebrow className="mb-3">The ladder</Eyebrow>
        <div className="border border-line bg-white px-4 py-5">
          <ol className="relative flex gap-0 overflow-x-auto pb-1">
            {sortedIdx.map((si, pos) => {
              const s = steps[si];
              const tone = TONE_BY_OFFSET(s.offsetDays);
              return (
                <li key={si} className={cn("relative min-w-[150px] flex-1 pt-4", pos > 0 && "pl-5")}>
                  <span aria-hidden className="absolute left-0 right-0 top-[7px] h-px bg-line" />
                  <span
                    className={cn(
                      "absolute left-0 top-0 h-[15px] w-[15px] rounded-full border-2 bg-white",
                      tone === "Final" ? "border-overdue" : tone === "Firm" ? "border-caution" : "border-pine-600"
                    )}
                  />
                  <p className="tnum text-xs font-semibold text-ink">
                    {s.offsetDays < 0 ? `${s.offsetDays}d` : `+${s.offsetDays}d`}
                    <span className="ml-1.5 font-sans font-normal text-ink-faint">vs due date</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm">{s.label}</p>
                  <p
                    className={cn(
                      "mt-1 inline-block px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.08em]",
                      tone === "Final" ? "bg-overdue-bg text-overdue" : tone === "Firm" ? "bg-caution-bg text-caution" : "bg-pine-50 text-pine-700"
                    )}
                  >
                    {tone}
                  </p>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 grid gap-x-8 gap-y-2 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-soft sm:grid-cols-3">
            <p><strong className="font-medium text-ink">On reply</strong> — chasing pauses for your snooze period, then resumes.</p>
            <p><strong className="font-medium text-ink">On payment</strong> — mark paid and every remaining step cancels instantly.</p>
            <p><strong className="font-medium text-ink">On pause</strong> — nothing sends until you resume. Previews stay available.</p>
          </div>
        </div>
      </section>

      {/* Step editors */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>Steps</Eyebrow>
          {!canEdit && (
            <span className="text-xs text-caution">Custom sequences need Starter or an active trial.</span>
          )}
        </div>

        <div className="space-y-4">
          {sortedIdx.map((si) => {
            const s = steps[si];
            return (
              <div key={si} className="border border-line bg-white px-4 py-4">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                  <Field label="Day vs due" htmlFor={`off-${si}`} className="w-28">
                    <input
                      id={`off-${si}`}
                      type="number"
                      value={s.offsetDays}
                      min={-60}
                      max={365}
                      onChange={(e) => update(si, { offsetDays: parseInt(e.target.value, 10) || 0 })}
                      disabled={!canEdit}
                      className={cn(input, "tnum")}
                    />
                  </Field>
                  <Field label="Label · internal only" htmlFor={`lbl-${si}`} className="flex-1 min-w-[180px]">
                    <input id={`lbl-${si}`} value={s.label} maxLength={60} onChange={(e) => update(si, { label: e.target.value })} disabled={!canEdit} className={input} />
                  </Field>
                  {steps.length > 1 && canEdit && (
                    <button
                      onClick={() => setSteps(steps.filter((_, i) => i !== si))}
                      className={`${btn.danger} mb-[1px]`}
                    >
                      Remove step
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-3">
                  <Field label="Subject" htmlFor={`sub-${si}`}>
                    <input id={`sub-${si}`} value={s.subjectTemplate} maxLength={300} onChange={(e) => update(si, { subjectTemplate: e.target.value })} disabled={!canEdit} className={cn(input, "font-mono text-xs")} />
                  </Field>
                  <Field
                    label="Body"
                    htmlFor={`body-${si}`}
                    hint={"Variables: {{customer_name}} {{invoice_number}} {{amount}} {{due_date}} {{days_late}} {{pay_link_block}} {{signature}}"}
                  >
                    <textarea id={`body-${si}`} value={s.bodyTemplate} rows={7} maxLength={8000} onChange={(e) => update(si, { bodyTemplate: e.target.value })} disabled={!canEdit} className={cn(textarea, "font-mono text-xs")} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() =>
              setSteps([
                ...steps,
                {
                  offsetDays: Math.max(...steps.map((x) => x.offsetDays)) + 7 || 28,
                  label: "New step",
                  subjectTemplate: "Re: invoice {{invoice_number}}",
                  bodyTemplate: "Hi {{customer_name}},\n\nFollowing up again on invoice {{invoice_number}} for {{amount}}.\n\n{{pay_link_block}}{{signature}}",
                },
              ])
            }
            disabled={!canEdit}
            className={btn.secondary}
          >
            Add step
          </button>
          <div className="flex items-center gap-3">
            {saved && <p className="text-sm font-medium text-paid">Sequence saved</p>}
            {error && <p className="text-sm text-overdue">{error}</p>}
            <button onClick={save} disabled={busy || !canEdit} className={btn.primary}>
              {busy ? "Saving…" : "Save sequence"}
            </button>
          </div>
        </div>
        {!canEdit && (
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            You&apos;re viewing the default Sekavo sequence. Upgrade to Starter to edit wording, timing, and add steps.
          </p>
        )}
      </section>
    </div>
  );
}
