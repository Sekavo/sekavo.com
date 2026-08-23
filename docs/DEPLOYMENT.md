# Deployment — production checklist

Status legend:
- **[AUTOMATED]** — already implemented in this repository; works once env vars are set.
- **[HUMAN]** — requires dashboard/DNS/credential actions outside the repo.

Everything the app reads is listed in `.env.example`. Nothing else is used.
No real secrets live in this repository.

---

## 0. Choose your hosting shape

| Shape | Database | Worker | Notes |
|---|---|---|---|
| **A. Single-node host** (Railway / Fly.io / VPS) | SQLite on a mounted volume (`file:/app/data/prod.db`) | Built-in `node-cron` (do **not** set `DISABLE_INTERNAL_CRON`) | Simplest. One process owns writes; ideal for first customers. |
| **B. Serverless** (Vercel) | PostgreSQL (Neon/Supabase/Vercel Postgres) via `prisma/schema.postgres.prisma` | Platform cron → `/api/cron/tick` (`vercel.json` included; 1-minute schedules need a paid Vercel plan — otherwise use an external pinger) | Required because serverless filesystems are ephemeral. |

Both shapes ship in this repo. Do not mix: serverless + SQLite will lose data.

---

## 1. Domain & DNS — [HUMAN]

1. Pick the sending domain for chase email, e.g. `notify.yourdomain.com`
   (a subdomain keeps your main domain's reputation safe).
2. Pick the reply-capture domain, e.g. `inbox.yourdomain.com`.
3. Add both to Resend → Domains and add the DNS records Resend displays
   (SPF, DKIM). Wait until both show **Verified** in the dashboard.
4. Point your app domain (`APP_URL`) at your host per its instructions.

> ⚠️ Nothing in this repository can complete domain verification.
> Chase emails will not deliver until Resend shows Verified.

## 2. Email sending (Resend) — [HUMAN] config, [AUTOMATED] code

1. [HUMAN] Create an API key → `RESEND_API_KEY`.
2. [HUMAN] Choose `EMAIL_FROM`, e.g. `"Paidhound <chase@notify.yourdomain.com>"`.
3. [AUTOMATED] Sending uses the Resend HTTP API; every message is persisted
   to `outbound_email_logs` with its provider id.
4. [AUTOMATED] Every chase carries `Reply-To: reply+<userId>@<INBOUND_DOMAIN>`
   so replies are captured even though customers see your business identity
   in the body/signature.

## 3. Inbound replies — [HUMAN] routing, [AUTOMATED] handling

1. [HUMAN] In Resend → Webhooks create an inbound route for the reply domain
   (`*@inbox.yourdomain.com`) pointing at:

   ```
   POST https://<APP_URL>/api/webhooks/inbound-email
   ```

2. [HUMAN] Copy the endpoint's **Signing secret** (`whsec_…`) into
   `RESEND_WEBHOOK_SECRET`.
3. [AUTOMATED] The endpoint then *requires* a valid Svix signature and rejects
   timestamps older than 5 minutes (replay defense).
4. [AUTOMATED] Handling chain: tenant match by `reply+<userId>@domain` →
   customer match by From address → SHA-256 dedup (duplicate deliveries are
   ignored) → sequence snooze → payment-keyword flag → owner notification.

Local/self-hosted providers that cannot sign with Svix may use
`INBOUND_EMAIL_SECRET` + header `x-webhook-secret` instead. When
`RESEND_WEBHOOK_SECRET` is set it takes precedence and static secrets are
ignored — do not rely on the fallback in production.

## 4. Delivery events (bounces) — [HUMAN] subscribe, [AUTOMATED] handling

1. [HUMAN] In Resend → Webhooks subscribe the same signing secret to delivery
   events, pointed at:

   ```
   POST https://<APP_URL>/api/webhooks/resend
   ```

2. [AUTOMATED] `email.delivered/bounced/complained` are matched to sent chase
   emails by provider message id; bounces surface as a warning strip on the
   owner's dashboard within one page load after the event.

## 5. Database

- **Shape A (SQLite):** mount a volume, set `DATABASE_URL=file:/app/data/prod.db`,
  run `npx prisma migrate deploy && npm start`. Backups = copy the volume file.
- **Shape B (Postgres):** set `DATABASE_URL=postgresql://…`,
  run `npm run db:pg:push` against the fresh database (schema-first; no SQLite
  migration history applies), then deploy. The Prisma schema has no
  SQLite-specific types, so no other changes are required.

## 6. Billing (Stripe) — [HUMAN]

1. Create three recurring prices matching the published plans:
   Starter $19/mo · Pro $49/mo · Agency $149/mo → copy price IDs into
   `STRIPE_PRICE_*`.
2. Webhook endpoint `https://<APP_URL>/api/webhooks/stripe` with events:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
3. Configure the Customer Portal (plans + cancellation) in Stripe settings.
4. Test mode first: the same env vars accept `sk_test_`/test prices; nothing in
   the code hardcodes test behavior.

Without Stripe keys the app runs billing-disabled: trials and Free limits work,
upgrade buttons explain that checkout isn't configured.

## 7. Cron / worker

- **[AUTOMATED]** `/api/cron/tick` accepts `Authorization: Bearer <CRON_SECRET>`
  or `?secret=<CRON_SECRET>`; concurrent invocations are safe (atomic row
  claims); claims stuck >15 min are requeued automatically.
- **[HUMAN]** Choose ONE scheduler:
  - Single-node host: nothing to do (`node-cron` runs in-process).
  - Vercel Pro: `vercel.json`'s every-minute schedule activates on deploy.
  - Vercel Hobby / anywhere else: point cron-job.org (or similar) at
    `https://<APP_URL>/api/cron/tick?secret=<CRON_SECRET>` every minute.

## 8. Environment variables (production)

Set exactly what `.env.example` documents. Minimum viable production set:

```
DATABASE_URL  APP_URL  AUTH_SECRET  CRON_SECRET
RESEND_API_KEY  EMAIL_FROM  INBOUND_DOMAIN  RESEND_WEBHOOK_SECRET
ADMIN_EMAILS=<you>
DISABLE_INTERNAL_CRON=1        # serverless only
```

Stripe variables when enabling paid plans. `INBOUND_EMAIL_SECRET` only for
non-Svix providers.

## 9. Deploy & smoke — [AUTOMATED]

```bash
# health (db reachable, worker not stalled):
curl -s https://<APP_URL>/api/health

# worker executes and reports:
curl -s -X POST "https://<APP_URL>/api/cron/tick?secret=<CRON_SECRET>"
```

Then click through: signup → settings → add invoice due tomorrow → confirm five
scheduled steps on the invoice detail page.

## 10. First REAL email test — [HUMAN]

Requires completed sections 1–3 and one real inbox you control (e.g. Gmail).

1. Sign up as yourself; set sender details; finish onboarding.
2. Add an invoice for yourself as customer, **due date = yesterday**
   (catch-up sends one appropriately-toned email ~60 min later; wait for the
   minute cron, or trigger `/api/cron/tick`).
3. Verify in the real mailbox: sender = `EMAIL_FROM`, Reply-To =
   `reply+<userId>@<INBOUND_DOMAIN>`, payment link present, tone correct.
4. Reply from that mailbox ("payment coming Friday").
5. Within seconds–minutes: activity log shows *Reply received*, remaining
   chases show a snoozed date, and the account email receives the owner
   notification.
6. Send the identical reply again (re-send the same message): no duplicate
   activity event is created.
7. Mark the invoice paid in the dashboard: all scheduled chases flip to
   Cancelled and no further email sends.

Until step 4 succeeds against real mailboxes, Paidhound is NOT production-
ready — do not skip this because unit tests pass.

## 11. Security posture (verified in-repo)

- `.env*` git-ignored; no credentials committed.
- Svix signatures + replay window on all Resend webhooks; shared-secret path
  auto-disables when Svix is configured.
- Stripe webhooks signature-verified; cron endpoint bearer-authenticated.
- Tenant isolation enforced on every query (cross-account → 404); CSRF origin
  checks on mutations; request-size caps; rate limiting on auth; CSV formula-
  injection neutralization; API keys stored hashed.
- Demo seed refuses to run in production without explicit override
  (`ALLOW_DEMO_SEED=1`) because demo credentials are public in this repo.
