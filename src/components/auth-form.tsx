"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, input, label, Logo } from "@/components/ui";

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
    router.push(mode === "signup" ? "/app?welcome=1" : "/app");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Logo />
      <div className="mt-6 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === "signup" ? "14 days of Pro. No credit card required." : "Log in to your chase dashboard."}
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label htmlFor="name" className={label}>Your name</label>
                <input id="name" name="name" required maxLength={80} className={input} placeholder="Maya Chen" />
              </div>
              <div>
                <label htmlFor="businessName" className={label}>Business name <span className="text-neutral-400">(optional)</span></label>
                <input id="businessName" name="businessName" maxLength={120} className={input} placeholder="Acme Design Studio" />
              </div>
            </>
          )}
          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={input} placeholder="you@studio.com" />
          </div>
          <div>
            <label htmlFor="password" className={label}>
              Password {mode === "signup" && <span className="font-normal text-neutral-400">(min 8 chars)</span>}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={input}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className={`${btn.primary} w-full py-2.5`}>
            {busy ? "Working…" : mode === "signup" ? "Start free trial" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-500">
          {mode === "signup" ? (
            <>Already have an account? <Link href="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="font-medium text-indigo-600 hover:underline">Start free trial</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
