# Paidhound

**Automated invoice chasing for freelancers, consultants and micro-agencies.**

You did the work. Paidhound does the asking: polite, persistent, escalating email
follow-ups on your unpaid invoices — with reply detection that stops chasing the
moment a customer responds, payment links in every reminder, and a cash dashboard
that shows exactly what's outstanding and how late it is.

## Why it exists

- US small businesses are owed **$17,500 on average** in overdue invoices (Intuit, 2025)
- **29% of freelance invoices are paid late**; freelancers spend ~20 days/year chasing (Bonsai / IPSE)
- Dedicated AR tools cost **$69–$900+/month** and target companies with finance teams.
  Native QuickBooks/Xero reminders are free but static, reply-blind, and easy to ignore.

Paidhound occupies the gap: **$19/month, self-serve, works with any invoicing method**
(QuickBooks, Xero, FreshBooks, Wave, Stripe payment links, PDFs…), and it actually
*responds to customer behavior* instead of firing blind schedules.

## Quick start (local)

```bash
npm install
cp .env.example .env          # defaults work out of the box for local dev
npx prisma migrate dev        # creates SQLite DB + schema
npm run db:seed               # optional demo data
npm run dev                   # http://localhost:3000
```

Demo login (after seeding): `demo@paidhound.com` / `demopass123`

Without an email provider configured, chase emails are written to the
`outbound_email_logs` table and logged to the console — so you can exercise the
full product locally. The in-app worker runs every minute via `src/instrumentation.ts`.

## What's inside

| Area | Details |
|---|---|
| Chase engine | Escalating sequence anchored to each due date (−3d heads-up → +21d final notice), rendered fresh at send time |
| Reply handling | Inbound email webhook matches customer, pauses their chases (snooze N days), flags "payment reported" keywords, notifies you |
| Catch-up rule | Invoice added after its due date gets exactly one current-state email now — never retroactive spam — then continues the ladder |
| Dashboard | Outstanding/overdue/collected stats, AR aging buckets, next chases queue, activity feed, plan capacity meter |
| Invoices | Manual entry, CSV import with validation, clone-for-recurring, pause/resume, mark paid (cancels pending instantly) |
| Billing | Stripe Checkout + Customer Portal, webhook-driven plan sync, per-plan caps enforced at creation *and* at send time |
| Public API | `POST /api/v1/invoices` with hashed API keys (Pro+) |
| Admin | MRR estimate, signups, sends/replies, event counts at `/app/admin` |
| Ops | Structured JSON logs, analytics events, security headers, error boundaries, single-flight worker, cron endpoint |

## Plans

| Plan | Price | Active chased invoices | Highlights |
|---|---|---|---|
| Free | $0 | 3 | Full engine, default sequence, Paidhound footer |
| Starter | $19/mo | 25 | Custom sequences, CSV import |
| Pro | $49/mo | 100 | API access, white-label footer |
| Agency | $149/mo | 500 | For bookkeepers managing client AR |

Every signup starts with **14 days of Pro, no card required**. Pricing metric:
active chased invoices (paid/paused/void don't count).

## Documentation

- [Deployment](docs/DEPLOYMENT.md) — **production checklist**: hosting shapes, Resend domain/DNS + webhooks (Svix), Stripe, cron, first real email test. Clearly separates [AUTOMATED] from [HUMAN] steps
- [Architecture](docs/ARCHITECTURE.md) — system design, data model, engine rules, security model
- [Product & GTM](docs/PRODUCT.md) — pricing strategy, competitor analysis, ICP, acquisition plan
- [Known weaknesses](docs/WEAKNESSES.md) — honest list of what would block growth

## Tech stack

Next.js 16 (App Router, RSC) · TypeScript · Prisma + SQLite (Postgres-portable) ·
Tailwind v4 · jose JWT sessions · bcryptjs · node-cron + secured tick endpoint ·
Resend SDK · Stripe SDK · Zod validation. No other runtime dependencies.
