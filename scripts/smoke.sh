#!/bin/bash
# End-to-end smoke test against a running instance (default http://localhost:3000)
# Usage: BASE=http://localhost:3000 ./scripts/smoke.sh
set -e
BASE="${BASE:-http://localhost:3000}"
DB="${DB:-prisma/dev.db}"
PASS=0; FAIL=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✓ $1"; else FAIL=$((FAIL+1)); echo "✗ $1 (expected $2, got $3)"; fi
}
EMAIL="smoke-$RANDOM@test.local"

# 1. Landing & pricing render
check "landing 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/)"
check "pricing 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/pricing)"

# 2. Signup
curl -s -c /tmp/smoke.txt -X POST $BASE/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"smokepass123\"}" > /dev/null
ME=$(curl -s -b /tmp/smoke.txt http://localhost:3000/api/invoices -o /dev/null -w '%{http_code}')
check "authed API access" 200 "$ME"
check "dashboard renders" 200 "$(curl -s -b /tmp/smoke.txt -o /dev/null -w '%{http_code}' $BASE/app)"

# 3. Create overdue invoice
INV=$(curl -s -b /tmp/smoke.txt -X POST $BASE/api/invoices -H "Content-Type: application/json" \
  -d '{"customerName":"Smoke Client","customerEmail":"sc@x.test","number":"SMOKE-1","amountCents":123400,"currency":"USD","issuedAt":"2026-06-01","dueAt":"2026-07-01"}')
INV_ID=$(echo "$INV" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$INV_ID" ] && check "invoice created" ok ok || check "invoice created" id "MISSING"

# 4. Tick sends catch-up email (console sink writes outbound_email_logs)
curl -s -X POST "$BASE/api/cron/tick?secret=$CRON_SECRET" > /dev/null 2>&1 || true

# 5. Mark paid cancels pendings
curl -s -b /tmp/smoke.txt -X PATCH $BASE/api/invoices/$INV_ID -H "Content-Type: application/json" -d '{"status":"paid"}' > /dev/null
CANCELLED=$(sqlite3 "$DB" "SELECT COUNT(*) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND status='cancelled'")
[ "$CANCELLED" -ge 1 ] && check "paid cancels chases" ok ok || check "paid cancels chases" ">0" "$CANCELLED"

# 6. Tenant isolation: other account's invoice 404s
OTHER_ID=$(sqlite3 "$DB" "SELECT id FROM invoices WHERE number='INV-1042' LIMIT 1")
check "tenant isolation 404" 404 "$(curl -s -b /tmp/smoke.txt -o /dev/null -w '%{http_code}' $BASE/app/invoices/$OTHER_ID)"

# 7. Unauthenticated dashboard redirects
check "unauthed /app → login" 307 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/app)"

# 8. Cron endpoint rejects bad secret
check "cron authz" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/cron/tick -H 'Authorization: Bearer wrong')"

# 9. CSRF: cross-origin mutation with Origin header is rejected
check "cross-origin mutation blocked" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/smoke.txt -X POST $BASE/api/invoices -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{}')"
check "same-origin mutation allowed" 201 "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/smoke.txt -X POST $BASE/api/invoices -H "Origin: $BASE" -H 'Content-Type: application/json' -d '{"customerName":"CSRF Ok","customerEmail":"csrf@x.test","number":"SMOKE-CSRF","amountCents":100,"currency":"USD","issuedAt":"2026-08-01","dueAt":"2026-09-30"}')"
check "no-origin mutation (server client) allowed" 201 "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/smoke.txt -X POST $BASE/api/invoices -H 'Content-Type: application/json' -d '{"customerName":"No Origin","customerEmail":"noorigin@x.test","number":"SMOKE-NOORIGIN","amountCents":100,"currency":"USD","issuedAt":"2026-08-01","dueAt":"2026-09-30"}')"

echo
echo "Passed: $PASS  Failed: $FAIL"
[ "$FAIL" = "0" ]
