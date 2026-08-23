import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleCustomerReply } from "@/lib/engine";
import { logEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";

interface InboundPayload {
  to?: string | string[];
  from?: string;
  subject?: string;
  text?: string;
}

function extractUserIdFromRecipients(to: InboundPayload["to"]): string | null {
  const list = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
  const domain = (process.env.INBOUND_DOMAIN || "inbox.paidhound.com").toLowerCase();
  for (const addr of list) {
    const m = addr.toLowerCase().match(new RegExp(`^reply\\+([a-z0-9]+)@${domain.replace(/\./g, "\\.")}$`, "i"));
    if (m) return m[1];
  }
  return null;
}

/**
 * Inbound reply webhook. Configure your email provider (e.g. Resend Inbound,
 * Postmark inbound, Mailgun routes) to POST here. Payload is normalized to
 * { to, from, subject, text } — the most common fields across providers.
 * Authenticated via x-webhook-secret == INBOUND_EMAIL_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return NextResponse.json({ error: "Inbound not configured" }, { status: 503 });
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as InboundPayload | null;
  if (!body?.from || !body.to) return NextResponse.json({ error: "Missing from/to" }, { status: 400 });

  const userId = extractUserIdFromRecipients(body.to);
  if (!userId) {
    logger.warn("inbound:no_match", { to: body.to });
    return NextResponse.json({ ok: true, handled: false });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ ok: true, handled: false });

  // Strip any display name / angle brackets from From
  const fromEmail = body.from.match(/<([^>]+)>/)?.[1] ?? body.from;

  try {
    const result = await handleCustomerReply({
      ownerUserId: userId,
      fromEmail: fromEmail.toLowerCase(),
      subject: body.subject ?? "(no subject)",
      text: body.text ?? "",
    });
    if (result.handled) logEvent(userId, "inbound_reply_processed");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("inbound:processing_failed", { err: String(err) });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
