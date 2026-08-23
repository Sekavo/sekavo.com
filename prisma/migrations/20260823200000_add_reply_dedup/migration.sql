-- AlterTable: idempotency key for inbound reply processing
ALTER TABLE "conversation_events" ADD COLUMN "dedupKey" TEXT;
-- SQLite allows multiple NULLs on a unique column, so NULL dedupKeys are fine
CREATE UNIQUE INDEX "conversation_events_dedupKey_key" ON "conversation_events"("dedupKey");
