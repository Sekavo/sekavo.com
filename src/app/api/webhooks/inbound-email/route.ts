import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleCustomerReply } from "@/lib/engine";
import { logEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import {
  extractSvixHeaders,
  normalizeInboundPayload,
  verifySvixSignature,
} from "@/lib/inbound";

/**
 * Inbound reply webhook — the endpoint your email provider calls when a
 * customer replies to a chase (configured for e.g. *@inbox.yourdomain.com).
 *
 * Authentication, in order of preference:
 * 1. RESEND_WEBHOOK_SECRET set  → Svix signature REQUIRED (Resend production).
 *    Resend cannot send custom headers, so this is the production path.
 * 2. Else INBOUND_EMAIL_SECRET  → x-webhook-secret header must match
 *    (self-hosted providers / local testing only).
 * 3. Neither configured         → 503, inbound capture disabled.
 */
export async function POST(req: NextRequest) {
  const declaredLen = Number(req.headers.get("content-length") ?? "0");
  if (declaredLen > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const raw = await req.text();
  if (raw.length > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const svixSecret = process.env.RESEND_WEBHOOK_SECRET;
  const sharedSecret = process.env.INBOUND_EMAIL_SECRET;

  if (svixSecret) {
    const err = verifySvixSignature(svixSecret, extractSvixHeaders(req.headers), raw);
    if (err) {
      logger.warn("inbound:svix_rejected", { err });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (sharedSecret) {
    if (req.headers.get("x-webhook-secret") !== sharedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    return NextResponse.json({ error: "Inbound not configured" }, { status: 503 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = normalizeInboundPayload(parsed);
  if (!body) return NextResponse.json({ error: "Missing from/to" }, { status: 400 });

  // Locate the Sekavo mailbox this reply was sent to: reply+<userId>@domain
  const domain = (process.env.INBOUND_DOMAIN || "").toLowerCase();
  let userId: string | null = null;
  for (const addr of body.to) {
    const m = addr.toLowerCase().match(new RegExp(`^reply\\+([a-z0-9]+)@${(domain || ".+").replace(/\./g, "\\.")}$`, "i"));
    if (m && m[1]) {
      userId = m[1];
      break;
    }
  }
  if (!userId) {
    logger.warn("inbound:no_match", { to: body.to[0] });
    return NextResponse.json({ ok: true, handled: false });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ ok: true, handled: false });

  // Strip any display name / angle brackets from From
  const fromEmail = (body.from.match(/<([^>]+)>/)?.[1] ?? body.from).toLowerCase();

  try {
    const result = await handleCustomerReply({
      ownerUserId: userId,
      fromEmail,
      subject: body.subject.slice(0, 500),
      text: body.text.slice(0, 20000),
    });
    if (result.handled) logEvent(userId, "inbound_reply_processed");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("inbound:processing_failed", { err: String(err) });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
