import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Paidhound design system                                            */
/*  Editorial-financial: hairlines, sharp corners, tracked eyebrows,   */
/*  serif display, tabular figures. Color carries meaning only.        */
/* ------------------------------------------------------------------ */

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- brand ---------- */

export function Wordmark({
  className = "",
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-baseline gap-[3px] select-none", className)}>
      <span className="font-display text-[21px] font-semibold leading-none tracking-[-0.01em] text-ink">
        Paidhound
      </span>
      <span aria-hidden className="h-[5px] w-[5px] translate-y-[-1px] rounded-full bg-pine-600" />
    </Link>
  );
}

/* Small caption used above every section: uppercase, tracked, quiet. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint", className)}>
      {children}
    </p>
  );
}

/* ---------- typography helpers ---------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- surfaces ---------- */

/** A ruled panel — the only container primitive in the system. */
export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border border-line bg-white", className)}>
      {children}
    </div>
  );
}

/** Header row for a Surface: label left, optional action right, rule below. */
export function SurfaceHeader({
  title,
  action,
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 border-b border-line px-4 py-3", className)}>
      <h2 className="text-[13px] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
      {action && <div className="text-xs">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <p className="font-display text-[17px] font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ---------- buttons ---------- */

const btnBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3.5 h-9 text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-45";

export const btn = {
  primary: cn(btnBase, "bg-pine-700 text-white hover:bg-pine-800 active:bg-pine-900"),
  secondary: cn(btnBase, "border border-line-strong bg-white text-ink hover:border-ink-faint hover:bg-paper-sunken"),
  ghost: cn(btnBase, "px-2 text-ink-soft hover:text-ink"),
  danger: cn(btnBase, "border border-overdue/30 bg-white px-3 h-8 text-[13px] text-overdue hover:bg-overdue-bg"),
};

/* ---------- form controls ---------- */

export const input =
  "block w-full border border-line-strong bg-white px-3 h-9 text-sm text-ink placeholder:text-ink-faint focus:border-pine-600 outline-none transition-colors";
export const textarea = cn(input, "h-auto py-2 leading-relaxed");
export const labelText = "mb-1.5 block text-[13px] font-medium text-ink";

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelText}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

/* ---------- status language ---------- */

type Tone = "neutral" | "paid" | "overdue" | "caution" | "active" | "pine";

const dotTone: Record<Tone, string> = {
  neutral: "bg-line-strong",
  paid: "bg-paid",
  overdue: "bg-overdue",
  caution: "bg-caution",
  active: "bg-pine-500",
  pine: "bg-pine-600",
};

const textTone: Record<Tone, string> = {
  neutral: "text-ink-faint",
  paid: "text-paid",
  overdue: "text-overdue",
  caution: "text-caution",
  active: "text-pine-700",
  pine: "text-pine-700",
};

export function StatusLine({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
      <span aria-hidden className={cn("h-[7px] w-[7px] rounded-full", dotTone[tone])} />
      <span className={textTone[tone]}>{children}</span>
    </span>
  );
}

export function invoiceStatusView(status: string): { tone: Tone; label: string } {
  switch (status) {
    case "paid":
      return { tone: "paid", label: "Paid" };
    case "disputed":
      return { tone: "overdue", label: "Disputed" };
    case "bad_debt":
      return { tone: "overdue", label: "Bad debt" };
    case "void":
      return { tone: "neutral", label: "Void" };
    default:
      return { tone: "active", label: "Active" };
  }
}

/* ---------- data display ---------- */

export function Money({ cents, currency = "USD", className = "" }: { cents: number; currency?: string; className?: string }) {
  let text: string;
  try {
    text = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    text = `${(cents / 100).toFixed(2)} ${currency}`;
  }
  return <span className={cn("tnum", className)}>{text}</span>;
}

export function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < -60) {
    // future
    const mins = Math.floor(-s / 60);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.round(hours / 24);
    if (days === 0) return "today";
    return days === 1 ? "tomorrow" : `in ${days}d`;
  }
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function shortDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ---------- tables ---------- */

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line-strong px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 align-middle text-sm", className)}>{children}</td>;
}
