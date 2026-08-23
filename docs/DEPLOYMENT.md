# Deployment

Paidhound is a standard Next.js 16 app. Two supported paths:

## Option A — Vercel (recommended for launch)

1. Push this repo to GitHub, import into Vercel.
2. Provision Postgres (Vercel Postgres/Neon/Supabase) **or** keep SQLite on a
   persistent-volume host (see Option B) — Vercel's filesystem is ephemeral, so
   use Postgres there. Change `datasource db.provider` to `"postgresql"`, point
   `DATABASE_URL` at your instance and run `npx prisma migrate deploy`.
3. Set environment variables (see `.env.example`):

   ```
   DATABASE_URL        AUTH_SECRET (openssl rand -hex 32)
   CRON_SECRET         APP_URL=https://yourdomain.com
   RESEND_API_KEY      EMAIL_FROM      INBOUND_EMAIL_SECRET   INBOUND_DOMAIN
   STRIPE_SECRET_KEY   STRIPE_WEBHOOK_SECRET
   STRIPE_PRICE_STARTER  STRIPE_PRICE_PRO  STRIPE_PRICE_AGENCY
   ADMIN_EMAILS=you@yourdomain.com
   DISABLE_INTERNAL_CRON=1     # rely on Vercel Cron instead of in-proc cron
   ```

4. Cron: `vercel.json` schedules `/api/cron/tick` every minute (Pro plan).
   On Hobby, use a free external pinger (e.g. cron-job.org) hitting
   `https://yourdomain.com/api/cron/tick?secret=<CRON_SECRET>` every minute.

## Option B — Railway / Fly.io / any Node host with persistence

SQLite is genuinely fine at MVP scale (single writer, WAL-friendly workload).

1. `railway init` → add variables from above (keep `DATABASE_URL=file:./data/prod.db`,
   mount `./data` as a volume). Do **not** set `DISABLE_INTERNAL_CRON`.
2. Build: `npm run build`. Start: `npx prisma migrate deploy && npm start`.
3. Health check: `GET /api/cron/tick?secret=...` returns JSON tick stats.

## Email setup (Resend)

1. Create a Resend account, verify the domain you'll send from (SPF/DKIM records).
2. `EMAIL_FROM="YourName <chase@yourdomain.com>"`, `RESEND_API_KEY=re_...`
3. **Inbound replies:** create an inbound webhook in Resend (or Postmark/Mailgun)
   that POSTs messages for e.g. `*@inbox.yourdomain.com` to
   `https://yourdomain.com/api/webhooks/inbound-email` with header
   `x-webhook-secret: <INBOUND_EMAIL_SECRET>`.
   The normalized payload fields used: `{ to, from, subject, text }`
   (a tiny adapter function may be needed per provider — see the route handler).
4. Users see their personal capture address (`reply+<userId>@<INBOUND_DOMAIN>`)
   in Settings.

Without email env vars the app runs in **console-sink mode**: everything works,
emails land in logs + `outbound_email_logs`.

## Stripe billing setup

1. Create three recurring prices: Starter $19/mo, Pro $49/mo, Agency $149/mo.
2. Copy price IDs into `STRIPE_PRICE_*`.
3. Webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`, events:
   `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`.
4. Copy signing secret into `STRIPE_WEBHOOK_SECRET`.

Billing-disabled mode (empty keys) keeps the product usable; upgrade buttons show
a configuration notice instead of checkout.

## First-run checklist

- [ ] Sign up → Settings: confirm sender name/email/signature → Save (clears onboarding banner)
- [ ] Add one test invoice due tomorrow; run `POST /api/cron/tick` manually; check `outbound_email_logs`
- [ ] Send a fake reply through the inbound webhook; confirm snooze + notification
- [ ] Stripe test mode: subscribe, confirm plan badge updates from webhook
