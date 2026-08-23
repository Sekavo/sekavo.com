#!/bin/bash
# End-to-end: Maya Chen's first day on Paidhound (Phase 14 acceptance run).
# Boots its own server on :3100 with the internal cron disabled so the test
# controls exactly when chases fire. Usage: ./scripts/e2e.sh
set -e
cd "$(dirname "$0")/.."
PORT=3100
BASE="http://localhost:$PORT"
DB="prisma/dev.db"
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✓ $1"; else FAIL=$((FAIL+1)); echo "✗ $1 (expected $2, got $3)"; fi; }
sql() { sqlite3 "$DB" "$1"; }

RAND=$RANDOM
EMAIL="maya.e2e.${RAND}@test.local"

# ---- boot isolated server ----
pkill -f "next start.*$PORT" 2>/dev/null || true
DISABLE_INTERNAL_CRON=1 PORT=$PORT nohup npx next start -p $PORT > /tmp/paidhound-e2e.log 2>&1 &
E2E_PID=$!
trap 'kill $E2E_PID 2>/dev/null || true' EXIT
sleep 4

echo "— Maya signs up after landing on the site —"
check "landing reachable" 200 "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
curl -s -c /tmp/e2e.txt -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"name\":\"Maya Chen\",\"businessName\":\"Maya Chen Design\",\"email\":\"$EMAIL\",\"password\":\"mayapass123\"}" -o /dev/null
check "signup → session works" 200 "$(curl -s -b /tmp/e2e.txt -o /dev/null -w '%{http_code}' $BASE/app)"
USER_ID=$(sql "SELECT id FROM users WHERE email='$EMAIL'")

echo "— Onboarding: identity, signature, default payment link —"
SET_RES=$(curl -s -b /tmp/e2e.txt -X PATCH $BASE/api/settings -H 'Content-Type: application/json' \
  -d '{"senderName":"Maya Chen","senderEmail":"'"$EMAIL"'","businessName":"Maya Chen Design","signature":"— Maya\nMaya Chen Design","defaultPaymentUrl":"https://buy.stripe.com/test_maya","onboardingDone":true}')
check "settings save" ok "$(echo "$SET_RES" | grep -q '"ok":true' && echo ok || echo "fail: $SET_RES")"

echo "— Adds her real invoice: \$3,850, due in 16 days —"
DUE=$(date -u -v+16d +%Y-%m-%d 2>/dev/null || date -u -d '+16 days' +%Y-%m-%d)
ISSUED=$(date -u -v-14d +%Y-%m-%d 2>/dev/null || date -u -d '-14 days' +%Y-%m-%d)
INV=$(curl -s -b /tmp/e2e.txt -X POST $BASE/api/invoices -H 'Content-Type: application/json' \
  -d '{"customerName":"Lumen Agency","customerEmail":"billing@lumen.example","number":"MC-2087","amountCents":385000,"currency":"USD","issuedAt":"'"$ISSUED"'","dueAt":"'"$DUE"'","paymentUrl":"https://buy.stripe.com/test_maya_2087"}')
INV_ID=$(echo "$INV" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$INV_ID" ] && check "invoice created" ok ok || check "invoice created" id "MISSING: $INV"
LADDER=$(sql "SELECT COUNT(*) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND status='pending'")
check "full 5-step ladder scheduled" 5 "$LADDER"
FIRST_OFFSET_DAYS=$(sql "SELECT CAST((MIN(plannedFor)/1000 - strftime('%s','now'))/86400.0 AS INTEGER) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND status='pending'")
if [ "$FIRST_OFFSET_DAYS" -ge 12 ] && [ "$FIRST_OFFSET_DAYS" -le 14 ]; then
  check "next chase is the −3d heads-up (~13 days out)" ok ok
else
  check "next chase is the −3d heads-up (~13 days out)" "12-14" "$FIRST_OFFSET_DAYS"
fi

echo "— She previews exactly what the customer will receive —"
DETAIL=$(curl -s -b /tmp/e2e.txt "$BASE/app/invoices/$INV_ID")
echo "$DETAIL" | grep -q "Chase sequence" && check "sequence visible on invoice" ok ok || { FAIL=$((FAIL+1)); echo "✗ sequence visible (missing)"; }
echo "$DETAIL" | grep -E -q "Show email|Hide email" && check "email previews available" ok ok || { FAIL=$((FAIL+1)); echo "✗ email previews (missing)"; }
echo "$DETAIL" | grep -q "reply+${USER_ID}@" && check "reply-capture address shown" ok ok || { FAIL=$((FAIL+1)); echo "✗ reply-capture (missing)"; }

echo "— Invoice slips past due; she edits the due date rather than re-adding —"
NEW_DUE=$(date -u -v-9d +%Y-%m-%d 2>/dev/null || date -u -d '-9 days' +%Y-%m-%d)
NEW_DUE_ISO="${NEW_DUE}T12:00:00.000Z"
curl -s -b /tmp/e2e.txt -X PATCH $BASE/api/invoices/$INV_ID -H 'Content-Type: application/json' \
  -d '{"dueAt":"'"$NEW_DUE_ISO"'"}' -o /dev/null
PENDING_AFTER_EDIT=$(sql "SELECT COUNT(*) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND status='pending'")
CANCELLED_ON_EDIT=$(sql "SELECT COUNT(*) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND error LIKE '%due date changed%'")
[ "$PENDING_AFTER_EDIT" -ge 1 ] && [ "$CANCELLED_ON_EDIT" -ge 1 ] && check "due-date edit re-anchored ladder safely" ok ok || check "due-date edit re-anchored ladder safely" "pend>=1,cancel>=1" "$PENDING_AFTER_EDIT,$CANCELLED_ON_EDIT"

echo "— Time passes; the +7 nudge reaches its send moment —"
sql "UPDATE scheduled_emails SET plannedFor=1000000000000 WHERE invoiceId='$INV_ID' AND status='pending' AND stepIndex=(SELECT MIN(stepIndex) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND status='pending')"
BEFORE_LOGS=$(sql "SELECT COUNT(*) FROM outbound_email_logs WHERE userId='$USER_ID' AND kind='chase'")
curl -s -X POST "$BASE/api/cron/tick?secret=${CRON_SECRET:-dev-cron-secret}" > /dev/null
AFTER_LOGS=$(sql "SELECT COUNT(*) FROM outbound_email_logs WHERE userId='$USER_ID' AND kind='chase'")
check "exactly one chase sent" 1 "$((AFTER_LOGS - BEFORE_LOGS))"
BODY=$(sql "SELECT bodyText FROM outbound_email_logs WHERE userId='$USER_ID' AND kind='chase' ORDER BY sentAt DESC LIMIT 1")
SUBJ=$(sql "SELECT subject FROM outbound_email_logs WHERE userId='$USER_ID' AND kind='chase' ORDER BY sentAt DESC LIMIT 1")
echo "$BODY" | grep -q "Hi Lumen Agency," && check "greeting uses full customer name" ok ok || { FAIL=$((FAIL+1)); echo "✗ greeting wrong: ${BODY:0:60}"; }
echo "$BODY" | grep -q "buy.stripe.com/test_maya_2087" && check "payment link included" ok ok || { FAIL=$((FAIL+1)); echo "✗ pay link (missing)"; }
echo "$BODY" | grep -q '3,850.00' && check "amount formatted correctly" ok ok || { FAIL=$((FAIL+1)); echo "✗ amount (missing)"; }
echo "$SUBJ" | grep -E -qi "nudge|following up" && check "tone matches lateness (+7 nudge, not final notice)" ok ok || { FAIL=$((FAIL+1)); echo "✗ tone wrong: $SUBJ"; }

echo "— Customer replies; sequence must pause —"
INBOUND_DOMAIN=$(grep INBOUND_DOMAIN .env | cut -d'"' -f2)
PAYLOAD='{"to":["reply+'"$USER_ID"'@'"${INBOUND_DOMAIN:-inbox.paidhound.com}"'"],"from":"Billing <billing@lumen.example>","subject":"Re: MC-2087","text":"Hi Maya — approved this morning, payment runs Friday."}'
curl -s -X POST $BASE/api/webhooks/inbound-email -H "x-webhook-secret: dev-inbound-secret" -H 'Content-Type: application/json' -d "$PAYLOAD" > /dev/null
REPLIES=$(sql "SELECT COUNT(*) FROM conversation_events WHERE type='reply_received' AND invoiceId='$INV_ID'")
check "reply logged once" 1 "$REPLIES"
SNOOZED=$(sql "SELECT COUNT(*) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND status='pending' AND plannedFor/1000 > strftime('%s','now')+172800")
[ "$SNOOZED" -ge 1 ] && check "remaining chases snoozed past reply window" ok ok || check "remaining chases snoozed" ">=1 pending far" "$SNOOZED"
OWNER_NOTE=$(sql "SELECT COUNT(*) FROM outbound_email_logs WHERE userId='$USER_ID' AND kind='system'")
[ "$OWNER_NOTE" -ge 1 ] && check "owner notified of reply" ok ok || check "owner notified of reply" ">=1" "$OWNER_NOTE"

echo "— Duplicate webhook delivery is ignored —"
BEFORE_EVENTS=$(sql "SELECT COUNT(*) FROM conversation_events WHERE invoiceId='$INV_ID'")
curl -s -X POST $BASE/api/webhooks/inbound-email -H "x-webhook-secret: dev-inbound-secret" -H 'Content-Type: application/json' -d "$PAYLOAD" > /dev/null
AFTER_EVENTS=$(sql "SELECT COUNT(*) FROM conversation_events WHERE invoiceId='$INV_ID'")
check "replay adds no events" "$BEFORE_EVENTS" "$AFTER_EVENTS"

echo "— Payment arrives; she marks it paid —"
curl -s -b /tmp/e2e.txt -X PATCH $BASE/api/invoices/$INV_ID -H 'Content-Type: application/json' -d '{"status":"paid"}' -o /dev/null
CANCELLED=$(sql "SELECT COUNT(*) FROM scheduled_emails WHERE invoiceId='$INV_ID' AND status='cancelled'")
[ "$CANCELLED" -ge 1 ] && check "remaining chases cancelled on paid" ok ok || check "chases cancelled on paid" ">=1" "$CANCELLED"
LOGS_FINAL=$(sql "SELECT COUNT(*) FROM outbound_email_logs WHERE userId='$USER_ID' AND kind='chase'")
check "no accidental extra emails after payment" 1 "$LOGS_FINAL"
DASH=$(curl -s -b /tmp/e2e.txt $BASE/app)
echo "$DASH" | grep -q '3,850' && check "dashboard reflects collection" ok ok || check "dashboard reflects collection" '\$3,850' missing

echo "— Security spot-checks —"
OTHER_INV=$(sql "SELECT id FROM invoices WHERE number='INV-1042' LIMIT 1")
check "cross-tenant detail blocked" 404 "$(curl -s -b /tmp/e2e.txt -o /dev/null -w '%{http_code}' $BASE/app/invoices/$OTHER_INV)"
check "cron rejects bad secret" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/cron/tick -H 'Authorization: Bearer nope')"
check "cross-origin mutation blocked" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/e2e.txt -X POST $BASE/api/invoices -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{}')"

sql "DELETE FROM users WHERE email='$EMAIL'"
echo
echo "E2E: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
