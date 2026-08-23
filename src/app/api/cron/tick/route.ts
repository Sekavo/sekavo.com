import { NextRequest, NextResponse } from "next/server";
import { runWorkerLoop } from "@/lib/worker";

/**
 * Secured cron entrypoint for platform schedulers (Vercel Cron, GitHub Actions,
 * any uptime pinger). The internal node-cron loop also runs when possible;
 * this endpoint guarantees chases fire even on serverless platforms.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });

  const auth = req.headers.get("authorization") ?? new URL(req.url).searchParams.get("secret");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (bearer !== secret && auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWorkerLoop();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  // Vercel Cron issues GETs; allow ?secret= for platforms that can't set headers
  return handle(req);
}
