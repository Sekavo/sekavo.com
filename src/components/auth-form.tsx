"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, cn, input, labelText } from "./ui";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload =
      mode === "signup"
        ? {
            name: String(fd.get("name") ?? ""),
            businessName: String(fd.get("businessName") ?? ""),
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
          }
        : { email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") };

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    router.push(mode === "signup" ? "/onboarding" : "/app");
    router.refresh();
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em]">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        {mode === "signup"
          ? "14 days of Pro. No credit card. Your first chase can be scheduled in two minutes."
          : "Log in to see what's owed and what's been chased."}
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        {mode === "signup" && (
          <>
            <div>
              <label htmlFor="name" className={labelText}>Your name</label>
              <input id="name" name="name" required maxLength={80} autoComplete="name" className={input} placeholder="Maya Chen" />
            </div>
            <div>
              <label htmlFor="businessName" className={labelText}>
                Business name <span className="font-normal text-ink-faint">· optional</span>
              </label>
              <input id="businessName" name="businessName" maxLength={120} autoComplete="organization" className={input} placeholder="Acme Design Studio" />
            </div>
          </>
        )}
        <div>
          <label htmlFor="email" className={labelText}>Work email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={input} placeholder="you@studio.com" />
        </div>
        <div>
          <label htmlFor="password" className={labelText}>Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={cn(input, "tracking-widest")}
            placeholder={mode === "signup" ? "8+ characters" : "••••••••"}
          />
        </div>

        {error && (
          <p role="alert" className="border border-overdue/30 bg-overdue-bg px-3 py-2 text-sm text-overdue">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "One moment…" : mode === "signup" ? "Start free trial" : "Log in"}
        </button>
      </form>

      <p className="mt-6 border-t border-line pt-4 text-center text-sm text-ink-soft">
        {mode === "signup" ? (
          <>Already have an account? <Link href="/login" className="font-medium text-pine-700 hover:underline">Log in</Link></>
        ) : (
          <>New to Sekavo? <Link href="/signup" className="font-medium text-pine-700 hover:underline">Start free trial</Link></>
        )}
      </p>
    </div>
  );
}
