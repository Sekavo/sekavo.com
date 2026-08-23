import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword, rateLimit } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";
import { logEvent } from "@/lib/analytics";
import { DEFAULT_SEQUENCE } from "@/lib/email/templates";
import { TRIAL_DAYS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const body = await req.json().catch(() => null);
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    if (!rateLimit(`signup:${ip}`, 5)) {
      return NextResponse.json({ error: "Too many signups from this address. Try again later." }, { status: 429 });
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000);
    const passwordHash = await hashPassword(parsed.data.password);
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const user = await db.user.create({
      data: {
        email,
        name: parsed.data.name,
        businessName: parsed.data.businessName ?? null,
        passwordHash,
        isAdmin: adminEmails.includes(email),
        settings: {
          create: {
            senderName: parsed.data.name,
            senderEmail: email,
            businessName: parsed.data.businessName ?? "",
            sequence: JSON.stringify(DEFAULT_SEQUENCE),
          },
        },
        subscription: { create: { plan: "free", status: "trialing" } },
      },
    });
    await db.user.update({ where: { id: user.id }, data: { trialEndsAt } });

    logEvent(user.id, "user_signup", { plan: "trial", trialDays: TRIAL_DAYS });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Concurrent signups with the same email lose the unique-constraint race
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("signup failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
