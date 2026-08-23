# Architecture

## System overview

```
                    ┌───────────────────────────────────────────────┐
                    │                Next.js 16 app                 │
                    │                                               │
 Customer email ───▶│  POST /api/webhooks/inbound-email             │
 (reply)            │   └─ match user by reply+<userId>@domain      │
                    │   └─ match customer by From address           │
                    │   └─ log event → snooze pendings → notify     │
                    │                                               │
 Stripe ───────────▶│  POST /api/webhooks/stripe                    │
 (subscription)     │   └─ signature verify → sync plan/status      │
                    │                                               │
 Platform cron ────▶│  POST|GET /api/cron/tick  (Bearer CRON_SECRET)│
 or internal cron ─▶│  node-cron via src/instrumentation.ts         │
 (every minute)     │   └─ runWorkerLoop()  ← single-flight lock    │
                    │        ├─ runTick()                           │
                    │        │    ├─ due pending emails               │
                    │        │    ├─ re-check invoice state          │
                    │        │    ├─ enforce plan cap (rank-based)   │
                    │        │    ├─ render templates fresh          │
                    │        │    └─ sendEmail() adapter             │
                    │        └─ daily owner digest (once/day)       │
                    │                                               │
 User browser ─────▶│  RSC pages + route handlers (auth: JWT cookie)│
                    └───────────────────────────────────────────────┘
```

## Data model (Prisma / SQLite)

- **users** — credentials, admin flag, trial end
- **user_settings** — sender identity, signature, late-fee sentence, JSON-encoded
  chase sequence, catch-up toggle, reply-snooze days
- **customers** — unique per (userId, email); the join key for inbound replies
- **invoices** — money + dates + status (`active|paid|void|disputed|bad_debt`) +
  source (`manual|csv|stripe|qbo|api|clone`), `paymentUrl`, `chasingEnabled`
- **scheduled_emails** — one row per sequence step per invoice; statuses
  `pending → sent | skipped | cancelled | failed`; subject/body snapshotted at send
- **conversation_events** — unified timeline: chases sent, replies received,
  payment reports, notes
- **subscriptions** — Stripe customer/subscription ids, plan, status, period end
- **api_keys** — SHA-256 hashes only; raw key shown once at creation
- **analytics_events** — product analytics + digest de-duplication
- **outbound_email_logs** — every message sent, provider + status + body

## Chase engine rules

1. **Anchoring.** Each step's fire date = `invoice.dueAt + offsetDays`. Steps are
   stored at schedule-build time and re-rendered only at send time, so amount
   changes and elapsed days are always current. Date math is pure UTC ms, so DST
   transitions cannot shift offsets.
2. **Idempotent resync.** `syncScheduleForInvoice()` never duplicates a step
   (checks existing rows by stepIndex) and cancels pendings whose step was edited
   out of the sequence. Editing an invoice resyncs safely.
3. **Catch-up rule.** For invoices added already overdue: earlier missed steps are
   marked `skipped`; only the *latest* applicable step is scheduled after a
   60-minute safety window (`CATCHUP_DELAY_MS`), so users always have a chance to
   pause or edit before anything goes out. One relevant email beats four retro ones.
4. **Burst protection.** If several steps of one invoice become due simultaneously
   (worker downtime, bulk import), a single tick sends only the most advanced step
   and marks the rest `skipped: superseded`. Customers can never receive a pile-up.
5. **Exactly-once claiming.** The tick atomically claims rows via conditional
   update `pending → sending`; concurrent workers/instances that lose the race
   skip the row. Claims stalled >15 min (crash mid-send) are requeued once per
   tick by stale-claim recovery.
6. **Stop conditions.** Queued emails cancel immediately when an invoice is
   marked paid/void/disputed/bad_debt, chasing is paused, or the invoice deleted.
7. **Reply snooze.** A customer reply raises a floor: no queued step for that
   customer may fire within N days of now; steps already scheduled further out
   keep their dates. Identical webhook deliveries are ignored via SHA-256
   `dedupKey` on the conversation event (idempotent processing).
8. **Plan enforcement, twice.** At creation (402 with `upgradeRequired`) and again
   in `runTick`: active invoices ranked oldest-due-first; ranks ≥ plan cap are
   marked `skipped` with a reason. Canceled/expired/past-due subscriptions
   immediately drop to Free features (verified by regression tests).

## Send pipeline

`sendEmail()` writes to `outbound_email_logs` regardless of outcome. Provider
adapter: Resend HTTP API when `RESEND_API_KEY` is set; otherwise a console sink
for local development. Chase emails include a Sekavo footer unless the user's
plan strips it (white-label).

## Auth & security

- Sessions: HS256 JWT in an httpOnly, SameSite=Lax cookie (`secure` in prod),
  30-day expiry, verified in edge middleware for `/app/*`
- CSRF: SameSite=Lax **plus** middleware Origin-check on all mutating `/api`
  requests (browsers always send Origin cross-site; server clients without
  Origin are unaffected — cron/Stripe/email webhooks keep working)
- Passwords: bcrypt cost 10; plaintext never persisted or logged
- Login/signup rate-limited in-process (10/5 min per IP+email, signups capped),
  with periodic map pruning to prevent unbounded memory growth
- All input validated with Zod schemas at every route handler boundary
- Tenant isolation: every invoice/customer query is scoped by `userId` (verified:
  cross-account access returns 404)
- Webhooks authenticated: Stripe by signature, inbound email by shared secret,
  cron by bearer token (header or `?secret=`)
- Request-size caps: inbound email ≤1MB, CSV import ≤2MB, API ≤256KB (413 early)
- API keys: random 192-bit tokens, stored as SHA-256 hashes, revocable (verified:
  revoked key → 401), prefixed `ph_live_` for secret-scanner compatibility
- CSV export neutralizes spreadsheet formula injection (`=`, `+`, `-`, `@`, tab)
- Redirects never propagate user-supplied params; billing redirects use APP_URL only
- Security headers (nosniff, DENY frames, referrer policy) on every response

## Failure modes & mitigations

| Risk | Mitigation |
|---|---|
| Double-send (concurrent ticks, multi-instance) | Atomic per-row claim (`pending → sending` conditional update); losers skip |
| Crash mid-send | Stale `sending` claims requeued after 15 min; at-most-once resend window remains by design (documented) |
| Burst after downtime | Per-invoice coalescing: only the most advanced due step sends; others marked superseded |
| Provider outage | Email marked `failed` with error; visible in UI timeline; no automatic retry storms |
| Duplicate webhook deliveries | SHA-256 dedupKey on reply events → idempotent processing |
| Clock skew / long GC pause | Tick queries `plannedFor <= now` ordered ascending; idempotent per-row updates |
| SQLite growth | WAL not required at MVP scale; schema is Postgres-portable (no enums, standard types). Migration = change provider + `migrate deploy` |

## Performance profile (verified)

- All hot queries are index-backed (`EXPLAIN QUERY PLAN`: tick queue uses
  `scheduled_emails(status, plannedFor)`; plan-rank query uses
  `invoices(userId, status, dueAt)`; dedup lookup uses unique index).
- Tick is bounded at 250 emails/pass and O(n) queries per pass with a per-user
  rank cache — no N+1 in the send loop.
- **100 users**: trivial. **1,000 users**: fine on one Node process
  (~30 chase emails/hour average). **10,000 users**: move to Postgres (schema
  already portable), keep platform cron, add an email fan-out queue and read
  replicas for dashboards; daily digest job should batch by user segment.

## Tests

```bash
npm run test          # unit (30) + engine scenarios (25) against throwaway DB
npm run test:smoke    # 12 HTTP-level checks vs a running instance
```
Scenario coverage includes: concurrent ticks (exactly-once), duplicate webhook
deliveries (idempotency), payment/reply immediately before a chase, expired
trial & canceled-subscription downgrades, API-key revocation, stale-claim crash
recovery, DST-spanning date math, tenant isolation, provider delivery failure.
