import { NextRequest, NextResponse } from "next/server";
import { runWorkerLoop } from "@/lib/worker";

/**
 * Secured cron entrypoint for platform schedulers (Vercel Cron, GitHub Actions,
 * any uptime pinger). The internal node-cron loop also runs when possible;
 * this endpoint guarantees chases fire even on serverless platforms.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWorkerLoop();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}
