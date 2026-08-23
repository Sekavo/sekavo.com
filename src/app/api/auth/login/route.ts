import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, rateLimit, verifyPassword } from "@/lib/auth";
import { logEvent } from "@/lib/analytics";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();

    if (!rateLimit(`login:${ip}:${email}`, 10)) {
      return NextResponse.json({ error: "Too many login attempts. Try again in a few minutes." }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await logEvent(user.id, "user_login");
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("login failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
