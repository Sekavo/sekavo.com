import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildTemplateVars } from "@/lib/engine";
import { renderTemplate, sequenceFor } from "@/lib/email/templates";
import { Card, StatusBadge, Badge, btn } from "@/components/ui";
import { InvoiceActions } from "@/components/invoice-actions";

export const dynamic = "force-dynamic";

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

type DetailPageProps = { params: Promise<{ id: string }> };

export default async function InvoiceDetailPage({ params }: DetailPageProps) {
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

  const daysLate = Math.floor((Date.now() - invoice.dueAt.getTime()) / 86400000);

  // Live preview of what a pending step will say when it fires
  const fullForPreview = {
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
      settings: user.settings
        ? {
            senderName: user.settings.senderName,
            senderEmail: user.settings.senderEmail,
            replyTo: user.settings.replyTo,
            ccOwner: user.settings.ccOwner,
            signature: user.settings.signature,
            businessName: user.settings.businessName,
            lateFeePolicy: user.settings.lateFeePolicy,
            sequence: user.settings.sequence,
            catchUpOnLate: user.settings.catchUpOnLate,
            pauseOnReplyDays: user.settings.pauseOnReplyDays,
          }
        : null,
      subscription: user.subscription ? { plan: user.subscription.plan, status: user.subscription.status } : null,
      trialEndsAt: user.trialEndsAt,
    },
  };
  const steps = sequenceFor(user.settings);
  function previewFor(stepIndex: number): string | null {
    const step = steps[stepIndex];
    if (!step) return null;
    const { vars } = buildTemplateVars(fullForPreview);
    return `Subject: ${renderTemplate(step.subjectTemplate, vars)}\n\n${renderTemplate(step.bodyTemplate, vars).trim()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/app/invoices" className="hover:text-neutral-800">← Invoices</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{invoice.number}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {invoice.customer.name} · {invoice.customer.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={invoice.status} />
          {!invoice.chasingEnabled && invoice.status === "active" && <Badge>paused</Badge>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Timeline */}
          <Card>
            <h2 className="font-semibold">Chase timeline</h2>
            <ol className="mt-4 space-y-0">
              {invoice.scheduledEmails.map((e) => (
                <li key={e.id} className="relative border-l-2 border-neutral-100 pb-5 pl-5 last:pb-0">
                  <span
                    className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${
                      e.status === "sent"
                        ? "bg-emerald-500"
                        : e.status === "pending"
                          ? "bg-indigo-500"
                          : e.status === "failed"
                            ? "bg-red-500"
                            : "bg-neutral-300"
                    }`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{e.stepLabel}</span>
                    {e.status === "sent" && <Badge tone="green">sent</Badge>}
                    {e.status === "pending" && <Badge tone="blue">scheduled</Badge>}
                    {e.status === "skipped" && <Badge>skipped</Badge>}
                    {e.status === "cancelled" && <Badge>cancelled</Badge>}
                    {e.status === "failed" && <Badge tone="red">failed</Badge>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(e.sentAt ?? e.plannedFor).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {e.error ? ` · ${e.error}` : ""}
                  </div>
                  {(e.status === "sent" || e.body) && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline">View email</summary>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700">{e.body || "(content rendered at send time)"}</pre>
                    </details>
                  )}
                  {e.status === "pending" && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline">Preview next email</summary>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-indigo-50/50 p-3 text-xs leading-relaxed text-neutral-700">{previewFor(e.stepIndex)}</pre>
                    </details>
                  )}
                </li>
              ))}
              {invoice.scheduledEmails.length === 0 && (
                <li className="text-sm text-neutral-400">No chase schedule (invoice is paid or chasing was never enabled).</li>
              )}
            </ol>
            {invoice.status !== "active" && (
              <Link href="/app/invoices" className={`${btn.secondary} mt-4`}>Back to invoices</Link>
            )}
          </Card>

          {/* Conversation */}
          <Card>
            <h2 className="font-semibold">Conversation & history</h2>
            <ul className="mt-4 space-y-3">
              {invoice.events.map((ev) => (
                <li key={ev.id} className={`rounded-lg p-3 text-sm ${ev.direction === "inbound" ? "bg-emerald-50" : ev.direction === "outbound" ? "bg-indigo-50/60" : "bg-neutral-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {ev.type.replace(/_/g, " ")}
                      {ev.direction === "inbound" && " ←"}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {new Date(ev.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-neutral-700">{ev.rawText ?? ev.summary}</p>
                </li>
              ))}
              {invoice.events.length === 0 && <li className="text-sm text-neutral-400">Nothing yet.</li>}
            </ul>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Amount</dt><dd className="font-semibold tabular-nums">{money(invoice.amountCents, invoice.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Issued</dt><dd>{invoice.issuedAt.toLocaleDateString()}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Due</dt><dd>{invoice.dueAt.toLocaleDateString()}</dd></div>
              {invoice.paidAt && <div className="flex justify-between"><dt className="text-neutral-500">Paid</dt><dd className="text-emerald-600">{invoice.paidAt.toLocaleDateString()}</dd></div>}
              {invoice.lastChasedAt && <div className="flex justify-between"><dt className="text-neutral-500">Last chased</dt><dd>{invoice.lastChasedAt.toLocaleDateString()}</dd></div>}
              <div className="flex justify-between"><dt className="text-neutral-500">Source</dt><dd className="capitalize">{invoice.source}</dd></div>
              {invoice.paymentUrl && (
                <div className="pt-1"><dt className="mb-1 text-neutral-500">Payment link</dt><dd><a href={invoice.paymentUrl} target="_blank" rel="noreferrer" className="break-all text-indigo-600 hover:underline">{invoice.paymentUrl}</a></dd></div>
              )}
              {invoice.notes && (
                <div className="border-t border-neutral-100 pt-3"><dt className="mb-1 text-neutral-500">Notes</dt><dd className="whitespace-pre-wrap text-neutral-700">{invoice.notes}</dd></div>
              )}
              {invoice.status === "active" && daysLate > 0 && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">⚠️ {daysLate} day{daysLate === 1 ? "" : "s"} overdue</div>
              )}
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Take action</h2>
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              chasingEnabled={invoice.chasingEnabled}
              paymentUrl={invoice.paymentUrl}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
