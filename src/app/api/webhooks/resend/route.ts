import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractSvixHeaders, verifySvixSignature } from "@/lib/inbound";
import { logger } from "@/lib/logger";

/**
 * Resend delivery events for OUTBOUND chase email:
 * email.sent / email.delivered / email.bounced / email.complained.
 *
 * Events are matched to outbound_email_logs via the provider message id we
 * stored at send time, so bounces are visible instead of silent. Requires the
 * same Svix signature verification as production inbound webhooks; configure
 * this endpoint in the Resend dashboard alongside inbound routing.
 */
const MAPPED: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export async function POST(req: NextRequest) {
  const svixSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!svixSecret) {
    return NextResponse.json({ error: "Delivery events not configured" }, { status: 503 });
  }
  const raw = await req.text();
  if (raw.length > 500_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const err = verifySvixSignature(svixSecret, extractSvixHeaders(req.headers), raw);
  if (err) {
    logger.warn("resend_events:svix_rejected", { err });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = event.type ? MAPPED[event.type] : undefined;
  const providerId =
    typeof event.data?.email_id === "string"
      ? event.data.email_id
      : typeof (event.data as Record<string, unknown> | undefined)?.id === "string"
        ? (event.data as { id: string }).id
        : undefined;

  if (!status || !providerId) {
    // Uninteresting or unknown event type — acknowledge so retries stop.
    return NextResponse.json({ received: true, ignored: true });
  }

  // Idempotent by construction: setting the same status twice is harmless,
  // and a log that already reached a terminal state is not downgraded.
  const result = await db.outboundEmailLog.updateMany({
    where: { providerId, status: { in: ["sent", "failed"] } },
    data: { status },
  });

  if (status === "bounced") {
    logger.warn("resend_events:bounce", { providerId, matched: result.count });
  }
  return NextResponse.json({ received: true });
}
