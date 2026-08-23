/**
 * Unit tests for pure logic. Run: npx tsx scripts/unit.test.ts
 */
import { effectivePlan, PLANS } from "../src/lib/plans";
import { renderTemplate, parseSequence, sequenceFor, DEFAULT_SEQUENCE } from "../src/lib/email/templates";
import { escapeCsvCell } from "../src/lib/csv";
import { replyDedupKey } from "../src/lib/engine";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.log(`✗ ${name} ${detail}`);
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `→ got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

// ---------- effectivePlan matrix ----------
const FUTURE = new Date(Date.now() + 86400000);
const PAST = new Date(Date.now() - 86400000);

eq("trial active → pro", effectivePlan("free", "trialing", FUTURE).id, "pro");
eq("trial expired → free", effectivePlan("free", "trialing", PAST).id, "free");
eq("trial null end → free", effectivePlan("free", "trialing", null).id, "free");
eq("active starter → starter", effectivePlan("starter", "active", null).id, "starter");
eq("past_due → free (even with plan set)", effectivePlan("pro", "past_due", null).id, "free");
eq("canceled + plan=pro → free (regression)", effectivePlan("pro", "canceled", null).id, "free");
eq("unpaid → free", effectivePlan("agency", "unpaid", null).id, "free");
eq("unknown status → free", effectivePlan("pro", "weird", null).id, "free");
check("free cap is 3", PLANS.free.maxActiveInvoices === 3);

// ---------- template rendering ----------
const vars = {
  customer_name: "Sarah",
  first_name: "Sarah",
  invoice_number: "INV-1",
  amount: "$1,200.00",
  due_date: "Friday, August 21",
  days_late: 7,
  days_early: 0,
  business_name: "Acme",
  pay_link_block: "Pay: https://x.y",
  late_fee_line: "fee note",
  signature: "\n— Maya",
};
eq("substitutes all vars", renderTemplate("Hi {{customer_name}}, {{invoice_number}} for {{amount}}", vars), "Hi Sarah, INV-1 for $1,200.00");
eq("unknown var → empty", renderTemplate("x {{nope}} y {{days_late}}", vars), "x  y 7");
eq("injection-safe plain text", renderTemplate("{{invoice_number}}", { ...vars, invoice_number: "=HYPERLINK(\"evil\")" }), '=HYPERLINK("evil")'); // emails are text; no formula risk — documented
eq("repeated var works", renderTemplate("{{first_name}} {{first_name}}", vars), "Sarah Sarah");

// ---------- sequence parsing ----------
eq("invalid json → default", parseSequence("{not json").length, DEFAULT_SEQUENCE.length);
eq("non-array → default", parseSequence('{"a":1}').length, DEFAULT_SEQUENCE.length);
eq("filters malformed steps", parseSequence(JSON.stringify([
  { offsetDays: 3, label: "ok", subjectTemplate: "s", bodyTemplate: "b" },
  { label: "missing offset" },
  null,
  { offsetDays: 9, label: "ok2", subjectTemplate: "s2", bodyTemplate: "b2" },
])).map((s) => s.label), ["ok", "ok2"]);
eq("empty array → sequenceFor falls back to default", sequenceFor({ sequence: "[]" }).length, DEFAULT_SEQUENCE.length);
check("default steps ascend by offset", DEFAULT_SEQUENCE.every((s, i, a) => i === 0 || s.offsetDays >= a[i - 1].offsetDays));

// ---------- csv escaping ----------
eq("formula neutralized =", escapeCsvCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0".replace(/'/g, "'")); // prefix added
check("= prefixed", escapeCsvCell("=x").startsWith("'"));
check("+ prefixed", escapeCsvCell("+x").startsWith("'"));
check("- prefixed", escapeCsvCell("-x").startsWith("'"));
check("@ prefixed", escapeCsvCell("@x").startsWith("'"));
eq("plain untouched", escapeCsvCell("hello world"), "hello world");
eq("quote wrapping + doubling", escapeCsvCell('say "hi"'), '"say ""hi"""');
check("tab guarded", escapeCsvCell("\t=x").startsWith("'"));

// ---------- reply dedup ----------
const k1 = replyDedupKey("u1", "a@x.test", "Re: INV-1", "paid today");
const k2 = replyDedupKey("u1", "a@x.test", "Re: INV-1", "paid today");
const k3 = replyDedupKey("u2", "a@x.test", "Re: INV-1", "paid today");
const k4 = replyDedupKey("u1", "A@X.TEST", "Re: INV-1 ", " paid today ");
check("identical deliveries → same key", k1 === k2);
check("different tenant → different key", k1 !== k3);
check("case/whitespace normalized", k1 === replyDedupKey("u1", "A@X.TEST", "Re: INV-1", " paid today "));
check("different body → different key", k1 !== replyDedupKey("u1", "a@x.test", "Re: INV-1", "not paid"));

console.log(`\nUnit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
