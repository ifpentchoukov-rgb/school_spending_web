"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { getBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/admin";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus({ kind: "sending" });

    const supabase = getBrowserClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("redirect", redirect);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setStatus({ kind: "error", message: error.message });
    } else {
      setStatus({ kind: "sent" });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 text-sm">
        <p className="font-medium text-emerald-800 dark:text-emerald-300">
          Check your email
        </p>
        <p className="mt-1 text-emerald-700 dark:text-emerald-400">
          We sent a magic link to{" "}
          <span className="font-mono">{email.trim()}</span>. Click it to
          finish signing in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={status.kind === "sending" || !email.trim()}
        className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status.kind === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {status.kind === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      ) : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Researcher access is invite-only. If your email isn't in the
        allowlist, you'll be signed in as a public viewer.
      </p>
    </form>
  );
}
