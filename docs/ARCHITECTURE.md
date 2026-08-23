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
   changes and elapsed days are always current.
2. **Idempotent resync.** `syncScheduleForInvoice()` never duplicates a step
   (checks existing rows by stepIndex) and cancels pendings whose step was edited
   out of the sequence. Editing an invoice resyncs safely.
3. **Catch-up rule.** For invoices added already overdue: earlier missed steps are
   marked `skipped`; only the *latest* applicable step is scheduled (now +5 min)
   when catch-up is enabled. One relevant email beats four confusing retro ones.
4. **Stop conditions.** Pending emails cancel immediately when an invoice is
   marked paid/void/disputed/bad_debt, chasing is paused, or the invoice deleted.
5. **Reply snooze.** A customer reply pushes all of *that customer's* pending
   steps forward N days from max(now, plannedFor) — it delays rather than deletes.
6. **Plan enforcement, twice.** At creation (402 with `upgradeRequired`) and again
   in `runTick`: active invoices ranked oldest-due-first; ranks ≥ plan cap are
   marked `skipped` with a reason. Free users always get their 3 most urgent
   invoices chased even after downgrades.

## Send pipeline

`sendEmail()` writes to `outbound_email_logs` regardless of outcome. Provider
adapter: Resend HTTP API when `RESEND_API_KEY` is set; otherwise a console sink
for local development. Chase emails include a Paidhound footer unless the user's
plan strips it (white-label).

## Auth & security

- Sessions: HS256 JWT in an httpOnly, SameSite=Lax cookie (`secure` in prod),
  30-day expiry, verified in edge middleware for `/app/*`
- Passwords: bcrypt cost 10; plaintext never persisted or logged
- Login/signup rate-limited in-process (10/10 min per IP+email, 5/hour signups/IP)
- All input validated with Zod schemas at every route handler boundary
- Tenant isolation: every invoice/customer query is scoped by `userId` (verified:
  cross-account access returns 404)
- Webhooks authenticated: Stripe by signature, inbound email by shared secret,
  cron by bearer token (header or `?secret=`)
- API keys: random 192-bit tokens, stored as SHA-256 hashes, revocable, prefixed
  `ph_live_` for secret-scanner compatibility
- Security headers (nosniff, DENY frames, referrer policy) on every response

## Failure modes & mitigations

| Risk | Mitigation |
|---|---|
| Double-send (cron + endpoint race) | Single-flight flag on worker loop; DB row status transition acts as claim |
| Provider outage | Email marked `failed` with error; visible in UI timeline; no silent loss |
| Clock skew / long GC pause | Tick queries `plannedFor <= now` ordered ascending; idempotent per-row updates |
| SQLite growth | WAL not required at MVP scale; schema is Postgres-portable (no enums, standard types). Migration = change provider + `migrate deploy` |

## Scaling path

1. **Now:** single Node process (in-proc cron fine), SQLite
2. **<10k users:** Postgres + platform cron hitting `/api/cron/tick` (already built);
   move outbound email to a queue table consumed by a small worker if volume grows
3. **Later:** accounting integrations as separate sync workers writing into the
   same invoice/schedule tables — engine unchanged
