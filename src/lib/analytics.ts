import "server-only";
import { db } from "./db";

export async function logEvent(userId: string | null | undefined, type: string, meta?: Record<string, unknown>) {
  try {
    await db.analyticsEvent.create({
      data: { userId: userId ?? null, type, meta: meta ? JSON.stringify(meta) : null },
    });
  } catch {
    // analytics must never break the request path
  }
}
