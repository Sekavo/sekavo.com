# Product: positioning, pricing, competition

> **Sekavo** is a financial workflow tool: it runs professional invoice
> follow-ups on the business owner's behalf — escalating politely, pausing for
> replies, and stopping the instant an invoice is paid. It is an assistant,
> not a debt collector.

## The problem (why this is worth money)

Getting paid late is not an inconvenience — it's a cash-flow tax on small businesses:

- US small businesses with outstanding invoices are owed **$17.5K on average**; 47%
  carry invoices 30+ days overdue (Intuit Small Business Late Payments Report, 2025)
- UK SMEs are owed **£23.4B** in overdue invoices (Bacs via IPSE)
- **29% of freelance invoices are paid late** (Bonsai, n=3yrs of invoice data);
  freelancers spend **~20 days/year** chasing (IPSE) and report stress/sleep loss
- Recovery probability collapses after 90 days — consistency and early escalation
  are the two levers that actually move time-to-payment

The work itself is trivially automatable but emotionally expensive: people hate
asking for money, so they do it too gently, too late, or not at all.

## Target customer (ICP)

**Primary:** freelancers, consultants, designers/devs/marketers billing $3k–$50k/mo
to B2B clients on Net-15/30 terms, invoicing 5–40 times a month, using any mix of
QuickBooks/Xero/FreshBooks/Wave/Stripe links/PDFs.

**Secondary:** two-to-five-person agencies where the owner does the chasing.
**Channel partner:** independent bookkeepers managing AR for several small clients
(Agency plan).

Willingness to pay is anchored by the value of cash acceleration: shaving two
weeks off $60k/yr billed ≈ **$2,300 of working capital released**, against a $228/yr product.

## Positioning

> "Your invoices should chase themselves."

Differentiators vs the obvious alternatives:
1. **Works with anything** — no accounting-suite lock-in (Chaser/Trove/Paidnice all require Xero/QBO/Sage).
2. **Reply-aware** — native reminders fire blindly into an argument already answered; Sekavo snoozes when the customer responds.
3. **Self-serve at freelancer price** — Chaser starts at $259/mo; Upflow ~$440/mo quote-only; Trove £50/mo but Xero-centric and UK-focused.
4. **Escalation done professionally** — five written tones from courtesy to final notice, editable word-by-word.

## Pricing strategy

Metric: **active chased invoices per month** (aligns cost with received value;
paid/paused invoices don't count). Fixed monthly pricing beats % of collections
(Lunos-style) because customers hate paying more exactly when they finally get paid.

| Plan | Price | Cap | Rationale |
|---|---|---|---|
| Free | $0 | 3 | Land-and-expand: chase your worst payer forever free; footer ad = viral loop |
| Starter | $19/mo | 25 | Impulse-purchase tier for most freelancers |
| Pro | $49/mo | 100 | Agencies & busy consultants; API + white-label justify 2.5× |
| Agency | $149/mo | 500 | Bookkeepers running AR for multiple clients |

14-day Pro trial, no card → maximizes top-of-funnel; caps create natural,
non-hostile upgrade moments ("Free plan chases your 3 oldest invoices").

Unit economics: Resend sends ≈ $0.10–0.30/user/mo at this volume; Stripe takes
~3%; support load low by design (self-serve + email previews reduce "what did it
send?" tickets). Gross margin >90%.

## Competitor analysis

| Tool | Entry price | Model | Weak spot we exploit |
|---|---|---|---|
| Chaser | $259/mo | Turnover-band tiers | Priced for SMBs w/ finance teams; add-on pricing (SMS/portal); UK-centric |
| Upflow | ~$440/mo | Quote-only, ARR bands | No self-serve trial of automation; mid-market sales cycle |
| Paidnice | $69/mo | Flat | Requires Xero/QBO; no reply-awareness |
| Invoiced | ~$499/mo | Quote | Complex recurring-billing focus, mid-market |
| Trove | £50–135/mo | Flat | Xero-first, UK focus, no API emphasis |
| Lunos.ai | $200/mo +0.3% collected | Usage | Percentage pricing penalizes success; AI-agent trust barrier |
| LedgerUp | $500/mo | Fixed | SaaS contract-to-cash niche, overkill for freelancers |
| QB/Xero native reminders | Free | Bundled | Static schedules; no replies handling; no prioritization; easy to ignore |

Sources: vendor pricing pages and Accounting.Events AR review (June 2026), Trove comparison pages.

## Go-to-market

### First 10 customers (weeks 1–4)
1. **Communities**: Indie Hackers, r/freelance, r/webdev, Designer News, Freelance
   Heroes (UK), bookkeeping FB groups. Post the template library + ROI math, offer
   founder-led onboarding. Goal: 10 paying Starter accounts.
2. **Direct outreach**: 50 micro-agencies on Dribbble/Clutch with 5+ team members
   who publicly complain about payment terms; offer white-glove import.
3. **Bookkeeper partnerships**: 10 outreach messages/day to QuickBooks ProAdvisors
   offering free Agency accounts for their clients' worst payers.

### First 100 (months 2–6)
4. **SEO flywheel**: free tools + templates — "polite invoice reminder email templates",
   "late fee calculator" (UK statutory interest math is a magnet), "how to ask a
   client for payment" — each ends with the product CTA.
5. **Integration listings**: Xero app store / QBC apps marketplace once native sync ships.
6. **Footer loop**: every Free-tier email carries "Chased by Sekavo" — recipients
   are exactly the ICP (they owe money *and* invoice others).

### Product-led automation
Onboarding imports via CSV/API make setup minutes; digests re-engage weekly;
clone-for-recurring makes monthly retainers sticky.

## Why someone pays (the honest case)

- **Immediate, measurable ROI**: faster cash + fewer write-offs vs $19/mo.
- **Emotional relief**: removes the single most dreaded task in freelancing.
- **Professionalism**: consistent, escalating, polite chasing outperforms ad-hoc
  awkward asks — without risking relationships.
- **No switching cost**: complements whatever invoicing they already use.
