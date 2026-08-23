# Known weaknesses (self-critique)

Written to be disproven. Each item lists the mitigation that exists today and
what would be required to fully close the gap.

## 1. Sending domain is ours, not theirs (deliverability + trust)
Chase emails originate from a Sekavo-managed domain signed with the user's
business identity. Some customers will notice.
- **Mitigation today:** full email previews in-app, CC-me option, clear signature.
- **To close:** bring-your-own-domain via per-user Resend domain verification;
  or SMTP/OAuth "send as Gmail" integration (Google verification overhead).

## 2. Marking invoices paid is manual
We flag payment-reported replies but don't reconcile bank/Stripe automatically.
- **Mitigation today:** one-click mark-paid; keyword flagging; Stripe payment links included in emails.
- **To close:** Stripe webhook mapping (`paymentUrl` → invoice) and bank-feed matching.

## 3. No accounting-suite sync
Users must enter invoices twice if they also keep books in Xero/QBO.
- **Mitigation today:** CSV import + API make it minutes, not hours; positioning is tool-agnostic by design.
- **To close:** QBO/Xero OAuth sync (both have mature APIs; ~2–4 weeks eng).

## 4. Free native reminders are "good enough" for some
A freelancer with two clients may not pay $19/mo for consistency.
- **Counter:** reply-awareness, escalation quality, aging dashboard and API don't
  exist natively; the ICP invoices frequently enough that caps bite quickly.

## 5. Reply capture depends on inbound-webhook plumbing
If replies go straight to a personal address instead of `reply+…@domain`, they're invisible.
- **Mitigation today:** CC-me keeps owners informed; notification forwards content.
- **To close:** Gmail/Outlook read-only integration for thread detection.

## 6. Single-tenant-per-account (no teams)
Agencies want multiple seats with shared customer base.
- **Roadmap:** org model + seats on Agency plan.

## 7. Timezone-naive scheduling
Sends fire at UTC-derived times; a 9am-local send isn't guaranteed.
- **Mitigation today:** harmless for collections; documented.
- **To close:** store per-user timezone (field exists) and shift send window.

## 8. In-process cron assumes a long-lived process
On Vercel serverless, internal node-cron doesn't persist.
- **Mitigation today:** `/api/cron/tick` endpoint + vercel.json config + external pinger instructions; single-flight lock prevents double sends when both run.

## 9. Analytics are basic
Event counts, no funnel/cohort tooling.
- **To close:** PostHog integration (1 day).

## 10. Cold-start trust
New brand asking to talk to customers' clients.
- **Mitigation today:** free tier lets users watch exactly what gets sent before paying; email previews build confidence pre-purchase.

## What would block $1k MRR
Distribution, not product: the top-of-funnel must move from communities to SEO
templates/tools and bookkeeper partnerships.

## What would block $10k MRR
QBO/Xero sync and own-domain sending — both table-stakes for the $69+/mo buyer;
without them we stay in the under-$50 segment.
