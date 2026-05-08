"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types";

type Row = Database["public"]["Tables"]["researcher_allowlist"]["Row"];

export function AllowlistManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    const supabase = getBrowserClient();
    const { error: insErr } = await supabase
      .from("researcher_allowlist")
      .upsert(
        {
          email: email.trim().toLowerCase(),
          note: note || null,
          revoked_at: null,
        },
        { onConflict: "email" },
      );
    if (insErr) {
      setError(insErr.message);
      setSubmitting(false);
      return;
    }
    setEmail("");
    setNote("");
    setSubmitting(false);
    router.refresh();
  }

  async function revoke(emailToRevoke: string) {
    const supabase = getBrowserClient();
    await supabase
      .from("researcher_allowlist")
      .update({ revoked_at: new Date().toISOString() })
      .eq("email", emailToRevoke);
    setRows((r) =>
      r.map((row) =>
        row.email === emailToRevoke
          ? { ...row, revoked_at: new Date().toISOString() }
          : row,
      ),
    );
    router.refresh();
  }

  async function unrevoke(emailToUnrevoke: string) {
    const supabase = getBrowserClient();
    await supabase
      .from("researcher_allowlist")
      .update({ revoked_at: null })
      .eq("email", emailToUnrevoke);
    setRows((r) =>
      r.map((row) =>
        row.email === emailToUnrevoke ? { ...row, revoked_at: null } : row,
      ),
    );
    router.refresh();
  }

  return (
    <div>
      <form
        onSubmit={add}
        className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <input
          type="email"
          required
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono"
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Invite"}
        </button>
        {error ? (
          <div className="sm:col-span-3 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Note</th>
              <th className="text-left px-4 py-2 font-medium">Invited</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-500 dark:text-slate-400 text-sm"
                >
                  No invitees yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.email}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <td className="px-4 py-2 font-mono text-xs">{r.email}</td>
                  <td className="px-4 py-2">
                    {r.revoked_at ? (
                      <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        revoked
                      </span>
                    ) : (
                      <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
                    {r.note ?? ""}
                  </td>
                  <td
                    className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400"
                    suppressHydrationWarning
                  >
                    {new Date(r.invited_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.revoked_at ? (
                      <button
                        onClick={() => unrevoke(r.email)}
                        className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                      >
                        Re-activate
                      </button>
                    ) : (
                      <button
                        onClick={() => revoke(r.email)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
