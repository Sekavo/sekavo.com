import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await db.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "default";

  const raw = `skv_live_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const key = await db.apiKey.create({
    data: { userId: user.id, name, hash, prefix: raw.slice(0, 12) },
  });

  // The raw key is returned exactly once — only its hash is stored.
  return NextResponse.json({ key: { id: key.id, name: key.name, createdAt: key.createdAt }, secret: raw });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.apiKey.updateMany({ where: { id, userId: user.id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
