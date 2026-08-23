import { Resend } from "resend";
import { db } from "../db";
import { logger } from "../logger";

export interface SendArgs {
  userId?: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  cc?: string;
  kind?: "chase" | "digest" | "system";
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Sends an email through the configured provider (Resend in production,
 * console/dev sink locally). Every message is persisted to OutboundEmailLog
 * so the product can show exactly what customers received.
 */
export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
  const provider = resend ? "resend" : "console";
  try {
    let id: string | undefined;
    if (resend) {
      const res = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Sekavo <onboarding@resend.dev>",
        to: [args.to],
        subject: args.subject,
        text: args.text,
        ...(args.replyTo ? { replyTo: args.replyTo } : {}),
        ...(args.cc ? { cc: [args.cc] } : {}),
      });
      if (res.error) throw new Error(res.error.message);
      id = res.data?.id;
    } else {
      logger.info("email:sink", {
        kind: args.kind ?? "chase",
        to: args.to,
        cc: args.cc,
        subject: args.subject,
        preview: args.text.slice(0, 160),
      });
    }
    await db.outboundEmailLog.create({
      data: {
        userId: args.userId ?? "",
        toAddress: args.to,
        subject: args.subject,
        bodyText: args.text,
        kind: args.kind ?? "chase",
        provider,
        providerId: id,
        status: "sent",
      },
    });
    return { ok: true, id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("email:send_failed", { to: args.to, error });
    await db.outboundEmailLog.create({
      data: {
        userId: args.userId ?? "",
        toAddress: args.to,
        subject: args.subject,
        bodyText: args.text,
        kind: args.kind ?? "chase",
        provider,
        status: "failed",
        error,
      },
    }).catch(() => {});
    return { ok: false, error };
  }
}
