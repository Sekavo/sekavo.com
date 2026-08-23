/**
 * Unit tests for pure logic. Run: npx tsx scripts/unit.test.ts
 */
import { effectivePlan, PLANS } from "../src/lib/plans";
import { renderTemplate, parseSequence, sequenceFor, DEFAULT_SEQUENCE } from "../src/lib/email/templates";
import { escapeCsvCell } from "../src/lib/csv";
import { replyDedupKey, renderClean } from "../src/lib/engine";
import { normalizeInboundPayload, verifySvixSignature } from "../src/lib/inbound";
import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";

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
check("case/whitespace normalized", k1 === k4);
check("different body → different key", k1 !== replyDedupKey("u1", "a@x.test", "Re: INV-1", "not paid"));

// ---------- renderer cleanup + greeting semantics ----------
eq("renderClean collapses empty-block gaps", renderClean("Hi Sarah,\n\n\n\nBody here.\n\n\n— M"), "Hi Sarah,\n\nBody here.\n\n— M");
eq("renderClean trims trailing whitespace", renderClean("line one   \nline two\t"), "line one\nline two");
eq("renderClean keeps single newlines", renderClean("a\nb"), "a\nb");

import { buildTemplateVars } from "../src/lib/engine";
function fakeInv(customerName: string) {
  return {
    id: "i1", userId: "u1", number: "INV-1", amountCents: 10000, currency: "USD",
    dueAt: new Date(Date.now() - 5 * 86400000), status: "active", chasingEnabled: true,
    paymentUrl: null,
    customer: { name: customerName, email: "c@x.test" },
    user: {
      id: "u1", email: "o@x.test", businessName: "Studio",
      settings: { senderName: "O", senderEmail: "o@x.test", replyTo: null, ccOwner: false,
        signature: "", businessName: "Studio", lateFeePolicy: "", sequence: JSON.stringify(DEFAULT_SEQUENCE),
        catchUpOnLate: true, pauseOnReplyDays: 3 },
      subscription: { plan: "free", status: "active" }, trialEndsAt: null,
    },
  };
}
eq("greeting uses full customer name (companies safe)", buildTemplateVars(fakeInv("BigCo Inc") as never).vars.customer_name, "BigCo Inc");
eq("person name kept whole", buildTemplateVars(fakeInv("Sarah Chen") as never).vars.customer_name, "Sarah Chen");
eq("first_name available for optional use", buildTemplateVars(fakeInv("Sarah Chen") as never).vars.first_name, "Sarah");
check("days_late computed for overdue fixture", buildTemplateVars(fakeInv("X") as never).vars.days_late >= 4);

// ---------- svix signature verification ----------
const SECRET_B64 = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
const WHSEC = `whsec_${SECRET_B64}`;
const NOW_S = Math.floor(Date.now() / 1000);
function signedRequest(secretB64Bytes: string, id: string, ts: number, body: string) {
  const mac = createHmac("sha256", Buffer.from(secretB64Bytes, "base64"))
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return { "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${mac}` };
}
const payload = '{"type":"email.received","data":{"from":"a@b.test","to":["reply+u1@inbox.test"],"text":"paid"}}';
const good = signedRequest(SECRET_B64, "msg_1", NOW_S, payload);
const hdrs = { id: good["svix-id"], timestamp: good["svix-timestamp"], signature: good["svix-signature"] };

eq("valid svix signature accepted", verifySvixSignature(WHSEC, hdrs, payload, Date.now()), null);
check("tampered body rejected", verifySvixSignature(WHSEC, hdrs, payload + "x", Date.now()) !== null);
check("wrong secret rejected", verifySvixSignature(`whsec_${Buffer.from("ffffffffffffffffffffffffffffffff").toString("base64")}`, hdrs, payload, Date.now()) !== null);
check("stale timestamp rejected", (() => {
  const old = signedRequest(SECRET_B64, "msg_2", NOW_S - 3600, payload);
  return verifySvixSignature(WHSEC, { id: old["svix-id"], timestamp: old["svix-timestamp"], signature: old["svix-signature"] }, payload, Date.now()) !== null;
})());
check("missing headers rejected", verifySvixSignature(WHSEC, { id: null, timestamp: null, signature: null }, payload, Date.now()) !== null);
check("plain passphrase secret also works", (() => {
  const raw = "plain-passphrase-key";
  const mac = createHmac("sha256", raw).update(`${hdrs.id}.${NOW_S}.${payload}`).digest("base64");
  return verifySvixSignature(raw, { id: hdrs.id, timestamp: String(NOW_S), signature: `v1,${mac}` }, payload, Date.now()) === null;
})());

// ---------- inbound payload normalization ----------
eq("resend nested shape normalized", normalizeInboundPayload({ type: "email.received", data: { from: "A <a@b.test>", to: ["reply+u@inbox.test"], subject: "Re: x", text: "hi" } }), { to: ["reply+u@inbox.test"], from: "A <a@b.test>", subject: "Re: x", text: "hi" });
eq("flat shape normalized", normalizeInboundPayload({ from: "a@b.test", to: "reply+u@inbox.test", subject: "", text: "" })?.to, ["reply+u@inbox.test"]);
eq("object to-addresses handled", normalizeInboundPayload({ from: "a@b.test", to: [{ address: "reply+u@x.t" }] })?.to, ["reply+u@x.t"]);
check("missing from → null", normalizeInboundPayload({ to: ["x@y.z"] }) === null);
check("missing to → null", normalizeInboundPayload({ from: "x@y.z" }) === null);
check("garbage → null", normalizeInboundPayload(null) === null);

// ---------- deployment config guard ----------
// Vercel Hobby allows only daily crons. The worker must be triggered by an
// EXTERNAL scheduler instead; if vercel.json is ever re-added (e.g. after
// upgrading to Pro), it must not silently reintroduce a sub-daily schedule.
const vercelCfgPath = "vercel.json";
if (!existsSync(vercelCfgPath)) {
  check("no vercel.json in repo (external scheduler owns worker frequency)", true);
} else {
  try {
    const cfg = JSON.parse(readFileSync(vercelCfgPath, "utf8"));
    const crons = Array.isArray(cfg.crons) ? cfg.crons : [];
    const subDaily = crons.filter((c: { schedule?: string }) => {
      const f = typeof c.schedule === "string" ? c.schedule.trim().split(/\s+/) : [];
      return f.length === 5 && (f[0] === "*" || f[0].startsWith("*/"));
    });
    check("vercel.json declares no sub-daily cron (Hobby-safe)", subDaily.length === 0, JSON.stringify(subDaily));
  } catch {
    check("vercel.json parseable", false);
  }
}
check("tick endpoint file present", existsSync("src/app/api/cron/tick/route.ts"));
check("worker loop module present", existsSync("src/lib/worker.ts"));

console.log(`\nUnit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
