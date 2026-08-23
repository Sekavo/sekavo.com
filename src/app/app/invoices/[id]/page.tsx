import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildTemplateVars, captureAddressFor } from "@/lib/engine";
import { renderTemplate, sequenceFor } from "@/lib/email/templates";
import {
  Eyebrow, Money, StatusLine, cn, invoiceStatusView, shortDate, relTime,
} from "@/components/ui";
import { EmailPreview } from "@/components/email-preview";
import { InvoiceActions } from "@/components/invoice-actions";
import { NoteEditor } from "@/components/note-editor";

export const dynamic = "force-dynamic";

type StepState = "sent" | "sending" | "pending" | "skipped" | "cancelled" | "failed";

const stepMark: Record<StepState, { ring: string; fill: string; label: string }> = {
  sent: { ring: "border-paid", fill: "bg-paid", label: "Sent" },
  sending: { ring: "border-pine-500", fill: "bg-pine-200 animate-pulse", label: "Sending" },
  pending: { ring: "border-pine-600", fill: "bg-white", label: "Scheduled" },
  skipped: { ring: "border-line-strong", fill: "bg-paper-sunken", label: "Skipped" },
  cancelled: { ring: "border-line-strong", fill: "bg-white", label: "Cancelled" },
  failed: { ring: "border-overdue", fill: "bg-overdue", label: "Failed" },
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const invoice = await db.invoice.findFirst({
    where: { id, userId: user.id },
    include: {
      customer: true,
      scheduledEmails: { orderBy: { stepIndex: "asc" } },
      events: { orderBy: { occurredAt: "asc" } },
    },
  });
  if (!invoice) notFound();

  const daysLate = Math.floor((Date.now() - invoice.dueAt.getTime()) / 86_400_000);
  const status = invoiceStatusView(invoice.status);
  const paused = invoice.status === "active" && !invoice.chasingEnabled;

  // Render live previews for pending steps
  const steps = sequenceFor(user.settings);
  const previewInvoice = {
    id: invoice.id,
    userId: invoice.userId,
    number: invoice.number,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    dueAt: invoice.dueAt,
    status: invoice.status,
    chasingEnabled: invoice.chasingEnabled,
    paymentUrl: invoice.paymentUrl,
    customer: { name: invoice.customer.name, email: invoice.customer.email },
    user: {
      id: user.id,
      email: user.email,
      businessName: user.businessName,
      settings: user.settings,
      subscription: user.subscription
        ? { plan: user.subscription.plan, status: user.subscription.status }
        : null,
      trialEndsAt: user.trialEndsAt,
    },
  } as never;
  function previewFor(stepIndex: number): string | null {
    const step = steps[stepIndex];
    if (!step) return null;
    const { vars } = buildTemplateVars(previewInvoice);
    return renderTemplate(step.bodyTemplate, vars).trim();
  }

  const senderName = user.settings?.businessName || user.businessName || user.name;
  const capture = captureAddressFor(user.id);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-ink-faint">
        <Link href="/app/invoices" className="hover:text-ink hover:underline">Invoices</Link>
        <span aria-hidden>/</span>
        <span className="font-mono text-ink">{invoice.number}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.01em]">
              <span className="font-mono tracking-normal">{invoice.number}</span>
            </h1>
            <StatusLine tone={paused ? "caution" : status.tone}>
              {paused ? "Paused — no emails will send" : status.label}
            </StatusLine>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-medium text-ink">{invoice.customer.name}</span> · {invoice.customer.email}
          </p>
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          chasingEnabled={invoice.chasingEnabled}
        />
      </div>

      {/* Summary strip */}
      <dl className="grid grid-cols-2 border border-line bg-white sm:grid-cols-4">
        {[
          ["Amount", <Money key="a" cents={invoice.amountCents} currency={invoice.currency} />],
          ["Issued", shortDate(invoice.issuedAt)],
          ["Due", <span key="d" className={cn(daysLate > 0 && invoice.status === "active" && "text-overdue")}>{shortDate(invoice.dueAt)}</span>],
          [
            invoice.status === "paid" ? "Paid on" : daysLate > 0 && invoice.status === "active" ? "Overdue by" : "Time left",
            invoice.status === "paid" && invoice.paidAt ? (
              shortDate(invoice.paidAt)
            ) : daysLate > 0 && invoice.status === "active" ? (
              <span className="text-overdue">{daysLate} day{daysLate === 1 ? "" : "s"}</span>
            ) : (
              `${Math.max(0, Math.ceil(-daysLate))} day${Math.ceil(-daysLate) === 1 ? "" : "s"}`
            ),
          ],
        ].map(([label, value], i) => {
          const isLast = i === 3;
          return (
            <div
              key={i}
              className={cn(
                "border-line px-4 py-3",
                !isLast && "border-r",                    // right rule on every cell except the final one (desktop + mobile-left)
                i % 2 === 0 ? "" : "max-sm:border-r-0",   // mobile: only left column keeps its right rule
                i < 2 && "max-sm:border-b" // mobile: top row carries the divider
              )}
            >
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label as string}</dt>
              <dd className="tnum mt-1 font-display text-lg font-semibold leading-none">{value}</dd>
            </div>
          );
        })}
      </dl>

      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        {/* Chase sequence */}
        <section>
          <Eyebrow className="mb-3">Chase sequence</Eyebrow>

          {invoice.scheduledEmails.length === 0 ? (
            <p className="text-sm text-ink-faint">No chases were scheduled for this invoice.</p>
          ) : (
            <ol>
              {invoice.scheduledEmails.map((e, idx) => {
                const mark = stepMark[(e.status as StepState) in stepMark ? (e.status as StepState) : "cancelled"];
                const isLast = idx === invoice.scheduledEmails.length - 1;
                const when = e.sentAt ?? e.plannedFor;
                const body = e.body ?? previewFor(e.stepIndex) ?? "";
                const subject =
                  e.subject ||
                  (() => {
                    const step = steps[e.stepIndex];
                    if (!step) return "";
                    try {
                      // reuse rendered preview's first line heuristic is fragile; render subject directly
                      const { vars } = buildTemplateVars(previewInvoice);
                      return renderTemplate(step.subjectTemplate, vars);
                    } catch {
                      return "";
                    }
                  })();

                return (
                  <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* rail */}
                    <div className="relative flex w-4 shrink-0 justify-center">
                      {!isLast && <span aria-hidden className="absolute top-3 bottom-[-24px] w-px bg-line" />}
                      <span className={cn("z-10 mt-1 h-[11px] w-[11px] rounded-full border-2 bg-white", mark.ring)}>
                        <span className={cn("block h-full w-full rounded-full", e.status === "sent" || e.status === "failed" ? mark.fill : e.status === "pending" ? "" : mark.fill)} />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                        <p className="text-sm font-semibold text-ink">
                          {e.stepLabel}
                          <span className="ml-2 font-mono text-xs font-normal text-ink-faint">
                            due +{steps[e.stepIndex]?.offsetDays ?? "?"}d
                          </span>
                        </p>
                        <p className={cn("tnum text-xs", e.status === "sent" ? "text-ink-soft" : "text-ink-faint")}>
                          {e.status === "sent"
                            ? `Sent ${shortDate(e.sentAt ?? when)} · ${relTime(e.sentAt ?? when)}`
                            : e.status === "pending"
                              ? `Fires ${relTime(e.plannedFor)}`
                              : `${mark.label}${e.error ? ` · ${e.error}` : ""}`}
                        </p>
                      </div>

                      {(e.status === "sent" || e.status === "failed" || e.status === "pending") && body && (
                        <details open={idx === Math.min(1, invoice.scheduledEmails.length - 1)} className="group mt-2">
                          <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-xs font-medium text-pine-700 hover:underline">
                            <span className="group-open:hidden">Show email</span>
                            <span className="hidden group-open:inline">Hide email</span>
                          </summary>
                          <EmailPreview
                            className="mt-2"
                            tone={e.status === "pending" ? "scheduled" : "sent"}
                            meta={
                              e.status === "pending"
                                ? `fires ${shortDate(e.plannedFor)}`
                                : e.sentAt
                                  ? `sent ${shortDate(e.sentAt)}`
                                  : undefined
                            }
                            fromName={senderName}
                            fromEmail={user.settings?.senderEmail ?? user.email}
                            toEmail={invoice.customer.email}
                            replyTo={capture}
                            subject={subject}
                            body={body}
                          />
                          {e.status === "pending" && (
                            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
                              Preview renders with current amounts and dates. Pause the invoice or edit the sequence to change it.
                            </p>
                          )}
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Conversation history */}
          {invoice.events.length > 0 && (
            <div className="mt-10">
              <Eyebrow className="mb-3">Conversation & history</Eyebrow>
              <ul className="space-y-0 border-t border-line">
                {invoice.events.map((ev) => (
                  <li key={ev.id} className="border-b border-line py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={cn("text-[13px] font-medium", ev.direction === "inbound" ? "text-caution" : "text-ink")}>
                        {ev.type === "chase_sent" && "Chase sent"}
                        {ev.type === "reply_received" && "Reply received"}
                        {ev.type === "payment_reported" && "Payment reported"}
                        {ev.type === "manual_note" && "Note added"}
                        {!["chase_sent", "reply_received", "payment_reported", "manual_note"].includes(ev.type) && ev.type.replace(/_/g, " ")}
                      </p>
                      <p className="tnum shrink-0 text-[11px] text-ink-faint">
                        {new Date(ev.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    {ev.rawText ? (
                      <blockquote className="mt-1.5 whitespace-pre-wrap border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-soft">
                        {ev.rawText.length > 600 ? `${ev.rawText.slice(0, 600)}…` : ev.rawText}
                      </blockquote>
                    ) : (
                      <p className="mt-0.5 text-[13px] text-ink-soft">{ev.summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Side column */}
        <aside className="space-y-8">
          <section>
            <Eyebrow className="mb-3">Customer</Eyebrow>
            <div className="text-sm">
              <p className="font-medium text-ink">{invoice.customer.name}</p>
              <p className="mt-0.5 break-all text-ink-soft">{invoice.customer.email}</p>
              <Link
                href={`/app/invoices?customer=${invoice.customerId}`}
                className="mt-2 inline-block text-[13px] font-medium text-pine-700 hover:underline"
              >
                All invoices for this customer →
              </Link>
            </div>
          </section>

          <section>
            <Eyebrow className="mb-3">Details</Eyebrow>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Source</dt><dd className="capitalize">{invoice.source}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Last chased</dt><dd>{invoice.lastChasedAt ? relTime(invoice.lastChasedAt) : "never"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-faint">Currency</dt><dd className="tnum">{invoice.currency}</dd></div>
            </dl>
            {invoice.paymentUrl && (
              <a
                href={invoice.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block break-all border border-line bg-paper-sunken px-3 py-2 text-xs text-pine-700 hover:border-line-strong"
              >
                Payment link ↗
              </a>
            )}
          </section>

          <section>
            <Eyebrow className="mb-3">Private note</Eyebrow>
            <p className="whitespace-pre-wrap border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-soft">
              {invoice.notes || <span className="italic text-ink-faint">No note yet — context for future chases.</span>}
            </p>
            <div className="mt-2">
              <NoteEditor invoiceId={invoice.id} current={invoice.notes ?? ""} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
