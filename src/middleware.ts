import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "ph_session";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

function hostFrom(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * CSRF defense-in-depth: cookie auth is SameSite=Lax, but we additionally
 * reject state-changing cross-origin requests that present an Origin header
 * (browsers always send one for cross-site POSTs; curl/webhooks don't).
 */
function sameOriginOk(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser client (cron, Stripe, email provider)

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? hostFrom(req.url);
  const appUrl = process.env.APP_URL ? hostFrom(process.env.APP_URL) : "";
  return originHost(origin) === host || (appUrl !== "" && originHost(origin) === appUrl);
}

function originHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

export async function middleware(req: NextRequest) {
  // --- CSRF origin check for all /api mutations ---
  if (req.nextUrl.pathname.startsWith("/api") && !sameOriginOk(req)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secret());
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!valid && req.nextUrl.pathname.startsWith("/app")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = ""; // never propagate user-supplied params into redirects
    return NextResponse.redirect(url);
  }

  if (valid && (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*", "/login", "/signup"],
};
