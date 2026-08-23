#!/bin/bash
# Resets the scenario DB and runs engine integration tests.
set -e
cd "$(dirname "$0")/.."
rm -f prisma/scenario.db prisma/scenario.db-journal
DATABASE_URL="file:./scenario.db" npx prisma db push --skip-generate > /dev/null 2>&1
npx tsx scripts/scenario.test.ts
