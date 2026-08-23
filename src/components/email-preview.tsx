import { cn } from "./ui";

export interface EmailPreviewProps {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  replyTo?: string | null;
  subject: string;
  body: string;
  meta?: string;
  tone?: "sent" | "scheduled" | "plain";
  className?: string;
}

/**
 * Renders an email as it actually appears to the customer: envelope header
 * rows, subject line, plain-text body. Used on invoice detail (sent mail +
 * scheduled previews), the sequences page, and marketing pages.
 */
export function EmailPreview({
  fromName,
  fromEmail,
  toEmail,
  replyTo,
  subject,
  body,
  meta,
  tone = "plain",
  className = "",
}: EmailPreviewProps) {
  return (
    <div className={cn("border border-line bg-white", className)}>
      {/* window bar */}
      <div className="flex items-center justify-between border-b border-line bg-paper-sunken px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
          {tone === "scheduled" ? "Scheduled email" : "Email"}
        </span>
        {meta && <span className="tnum text-[11px] text-ink-faint">{meta}</span>}
      </div>

      <dl className="space-y-1 border-b border-line px-4 py-3 text-[13px] leading-snug">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-ink-faint">From</dt>
          <dd className="truncate">
            <span className="font-medium text-ink">{fromName}</span>{" "}
            <span className="text-ink-faint">&lt;{fromEmail}&gt;</span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-ink-faint">To</dt>
          <dd className="truncate text-ink-soft">{toEmail}</dd>
        </div>
        {replyTo && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-ink-faint">Reply-To</dt>
            <dd className="truncate font-mono text-xs text-pine-700">{replyTo}</dd>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <dt className="w-14 shrink-0 text-ink-faint">Subject</dt>
          <dd className="font-medium text-ink">{subject}</dd>
        </div>
      </dl>

      <div className="whitespace-pre-wrap px-4 py-4 text-[13px] leading-relaxed text-ink-soft">
        {body}
      </div>
    </div>
  );
}
