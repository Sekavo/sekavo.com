#!/bin/bash
# Sources test-time configuration from .env without echoing any secret.
# Usage: source "$(dirname "$0")/env.sh"
# Sets: TEST_CRON_SECRET, TEST_INBOUND_SECRET, TEST_DATABASE_URL

set -a
__dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$__dir/.env" ]; then
  while IFS='=' read -r key value; do
    key="$(echo "$key" | tr -d ' \r')"
    value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')"
    [ -z "$key" ] && continue
    case "$key" in
      \#*) continue ;;
      CRON_SECRET) TEST_CRON_SECRET="$value" ;;
      INBOUND_EMAIL_SECRET) TEST_INBOUND_SECRET="$value" ;;
      DATABASE_URL) TEST_DATABASE_URL="$value" ;;
    esac
  done < "$__dir/.env"
fi
set +a

# Local test suites always exercise the local SQLite database, regardless of
# what DATABASE_URL points at for production tooling.
TEST_DATABASE_URL="file:./dev.db"

export TEST_CRON_SECRET TEST_INBOUND_SECRET TEST_DATABASE_URL
