import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Liveness + worker-stuck signal for uptime pingers and the operator.
 * Deliberately returns no user data.
 *
 * `overdueQueue` > 0 for more than a few minutes means chase emails are
 * scheduled but nothing is running runWorkerLoop — check cron configuration.
 */
export async function GET() {
  try {
    const [pendingOverdue, failedRecently] = await Promise.all([
      db.scheduledEmail.count({
        where: { status: "pending", plannedFor: { lt: new Date(Date.now() - 10 * 60_000) } },
      }),
      db.outboundEmailLog.count({
        where: { status: "failed", sentAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      db: true,
      worker: pendingOverdue === 0 ? "ok" : "stale",
      overdueQueue: pendingOverdue,
      emailFailures24h: failedRecently,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 500 });
  }
}
