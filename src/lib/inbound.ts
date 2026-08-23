import { createHmac, timingSafeEqual } from "crypto";

/**
 * Production-grade inbound webhook authentication and payload normalization.
 *
 * Resend delivers inbound emails and delivery events via Svix-signed webhooks
 * (headers: svix-id, svix-timestamp, svix-signature). Self-hosted providers
 * (or local testing) may instead send a static shared secret header.
 *
 * Security rules:
 * - When a Svix secret is configured, a valid signature is REQUIRED.
 * - Timestamps older than SIGNATURE_TOLERANCE_S are rejected (replay defense).
 */

const SIGNATURE_TOLERANCE_S = 5 * 60;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function extractSvixHeaders(h: Headers): SvixHeaders {
  return {
    id: h.get("svix-id"),
    timestamp: h.get("svix-timestamp"),
    signature: h.get("svix-signature"),
  };
}

/**
 * Accepts "whsec_<base64>" (Svix format — always base64-decoded) or a plain
 * passphrase used as raw key material. Matches Svix SDK behavior.
 */
function keyBytes(secret: string): Buffer {
  if (!secret.startsWith("whsec_")) return Buffer.from(secret, "utf8");
  const b64 = secret.slice("whsec_".length);
  const decoded = Buffer.from(b64, "base64");
  // A valid base64 decode round-trips to the original length
  return decoded.length >= 16 ? decoded : Buffer.from(b64, "utf8");
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    // compare against self to keep timing uniform, then fail
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Verifies a Svix-signed request. Returns an error string on failure,
 * null when the signature is valid.
 */
export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  payload: string,
  nowMs = Date.now()
): string | null {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return "missing svix headers";
  }
  const ts = Number.parseInt(headers.timestamp, 10);
  if (!Number.isFinite(ts)) return "invalid svix timestamp";
  const age = Math.abs(nowMs / 1000 - ts);
  if (age > SIGNATURE_TOLERANCE_S) {
    return `svix timestamp outside tolerance (${Math.round(age)}s)`;
  }

  const expected = createHmac("sha256", keyBytes(secret))
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest("base64");

  const provided = headers.signature
    .split(/\s+/)
    .map((entry) => entry.replace(/^v1,/, "").trim())
    .filter(Boolean);

  if (provided.length === 0) return "empty svix signature";
  const expectedBuf = Buffer.from(expected, "base64");
  for (const candidate of provided) {
    if (safeEqual(Buffer.from(candidate, "base64"), expectedBuf)) return null;
  }
  return "signature mismatch";
}

/* ------------------------------------------------------------------ */
/* Payload normalization                                               */
/* ------------------------------------------------------------------ */

export interface NormalizedInboundEmail {
  to: string[];
  from: string;
  subject: string;
  text: string;
}

/**
 * Providers shape payloads differently:
 * - Resend inbound: { type: "email.received", data: { to, from, subject, text } }
 * - Simple forwarders/tests: { to, from, subject, text }
 * This returns the fields wherever they live; null when unusable.
 */
export function normalizeInboundPayload(parsed: unknown): NormalizedInboundEmail | null {
  const body = (parsed ?? {}) as Record<string, unknown>;
  const d = (body.data ?? body) as Record<string, unknown>;

  const rawTo = d.to ?? d.recipient ?? d.email;
  const from = typeof d.from === "string" ? d.from : typeof (d.from as Record<string, unknown>)?.address === "string" ? String((d.from as { address: string }).address) : "";
  const list = Array.isArray(rawTo)
    ? rawTo.map((x) => (typeof x === "string" ? x : String((x as { address?: string })?.address ?? "")))
    : typeof rawTo === "string"
      ? [rawTo]
      : [];

  const to = list.map((a) => a.trim()).filter(Boolean);
  if (!from || to.length === 0) return null;

  return {
    to,
    from,
    subject: typeof d.subject === "string" ? d.subject : "(no subject)",
    text: typeof d.text === "string" ? d.text : "",
  };
}
