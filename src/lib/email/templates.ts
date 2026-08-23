

export interface ChaseStep {
  offsetDays: number; // relative to due date (negative = before due)
  label: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

export const DEFAULT_SEQUENCE: ChaseStep[] = [
  {
    offsetDays: -3,
    label: "Friendly heads-up",
    subjectTemplate: "{{invoice_number}} is due on {{due_date}}",
    bodyTemplate: `Hi {{customer_name}},

Quick heads-up that invoice {{invoice_number}} for {{amount}} is due on {{due_date}}.

If everything looks good, no action needed until then — just wanted to make sure it's on your radar.

{{pay_link_block}}
{{signature}}`,
  },
  {
    offsetDays: 0,
    label: "Due today",
    subjectTemplate: "Invoice {{invoice_number}} is due today",
    bodyTemplate: `Hi {{customer_name}},

Just a quick note that invoice {{invoice_number}} for {{amount}} is due today.

If you've already sent payment, thank you — please disregard this note.

{{pay_link_block}}
{{signature}}`,
  },
  {
    offsetDays: 7,
    label: "Gentle nudge",
    subjectTemplate: "Following up on invoice {{invoice_number}} ({{amount}})",
    bodyTemplate: `Hi {{customer_name}},

Invoice {{invoice_number}} for {{amount}} was due on {{due_date}}, and it looks like it hasn't come through yet.

Could be an oversight, or it might be stuck in an approvals queue. If something's holding it up, let me know and I'll help sort it out.

{{late_fee_line}}
{{pay_link_block}}
{{signature}}`,
  },
  {
    offsetDays: 14,
    label: "Firm follow-up",
    subjectTemplate: "Overdue: invoice {{invoice_number}} ({{amount}}, {{days_late}} days)",
    bodyTemplate: `Hi {{customer_name}},

Invoice {{invoice_number}} for {{amount}} is now {{days_late}} days past its due date of {{due_date}}.

I'd appreciate an update on when I can expect payment. If there's an issue with the invoice itself, tell me and I'll fix it today.

{{late_fee_line}}
{{pay_link_block}}
{{signature}}`,
  },
  {
    offsetDays: 21,
    label: "Final notice",
    subjectTemplate: "Final reminder: invoice {{invoice_number}} — {{amount}} overdue",
    bodyTemplate: `Hi {{customer_name}},

This is a final reminder for invoice {{invoice_number}} for {{amount}}, which was due on {{due_date}} and is now {{days_late}} days late.

Please arrange payment within the next 3 business days. If I don't hear back by then, I'll need to pause any ongoing work and consider the next steps available for recovering the balance.

If payment has already been sent, send me the remittance details and I'll close this out immediately.

{{pay_link_block}}
{{signature}}`,
  },
];

export interface TemplateVars {
  customer_name: string;
  first_name: string;
  invoice_number: string;
  amount: string;
  due_date: string;
  days_late: number;
  days_early: number;
  business_name: string;
  pay_link_block: string;
  late_fee_line: string;
  signature: string;
}

export function renderTemplate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = (vars as unknown as Record<string, unknown>)[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function parseSequence(json: string): ChaseStep[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return DEFAULT_SEQUENCE;
    return parsed.filter(
      (s): s is ChaseStep =>
        s && typeof s.offsetDays === "number" && typeof s.subjectTemplate === "string" && typeof s.bodyTemplate === "string"
    );
  } catch {
    return DEFAULT_SEQUENCE;
  }
}

export function sequenceFor(settings: { sequence: string } | null | undefined): ChaseStep[] {
  if (!settings) return DEFAULT_SEQUENCE;
  const seq = parseSequence(settings.sequence);
  return seq.length ? seq : DEFAULT_SEQUENCE;
}
