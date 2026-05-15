"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createApiKey, revokeApiKey } from "./actions";

export type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  user_id: string;
  email: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function KeyManager({ initial }: { initial: KeyRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{
    id: string;
    secret: string;
    email: string;
  } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await createApiKey({
      email: email.trim(),
      name: name.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRevealedSecret({ id: res.id, secret: res.secret, email: res.email });
    setRows((r) => [
      {
        id: res.id,
        name,
        prefix: res.prefix,
        user_id: "",
        email: res.email,
        created_at: new Date().toISOString(),
        last_used_at: null,
        revoked_at: null,
      },
      ...r,
    ]);
    setEmail("");
    setName("");
    router.refresh();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Existing callers using it will fall back to anonymous tier immediately.")) {
      return;
    }
    const res = await revokeApiKey(id);
    if (!res.ok) {
      setError(res.error ?? "Revoke failed");
      return;
    }
    setRows((r) =>
      r.map((row) =>
        row.id === id
          ? { ...row, revoked_at: new Date().toISOString() }
          : row,
      ),
    );
    router.refresh();
  }

  return (
    <div>
      <form
        onSubmit={create}
        className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3"
      >
        <input
          type="email"
          required
          placeholder="researcher@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono"
          aria-label="Issuee email"
        />
        <input
          type="text"
          required
          placeholder="Key name (e.g. 'Stanford budget study 2026')"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
          aria-label="Key name"
        />
        <button
          type="submit"
          disabled={submitting || !email.trim() || !name.trim()}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create key"}
        </button>
        {error ? (
          <div className="sm:col-span-3 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : null}
      </form>

      {revealedSecret ? (
        <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
            New key for {revealedSecret.email} — copy now, you won&apos;t see
            it again
          </h3>
          <pre className="text-xs font-mono bg-white dark:bg-slate-950 rounded p-3 overflow-x-auto break-all whitespace-pre-wrap text-slate-900 dark:text-slate-100 border border-amber-200 dark:border-amber-800">
            {revealedSecret.secret}
          </pre>
          <button
            onClick={() => setRevealedSecret(null)}
            className="mt-3 text-xs text-amber-800 hover:underline dark:text-amber-300"
          >
            I&apos;ve copied it — dismiss
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left  px-4 py-2 font-medium">Name</th>
              <th className="text-left  px-4 py-2 font-medium">Issuee</th>
              <th className="text-left  px-4 py-2 font-medium">Prefix</th>
              <th className="text-left  px-4 py-2 font-medium">Created</th>
              <th className="text-left  px-4 py-2 font-medium">Last used</th>
              <th className="text-left  px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500 dark:text-slate-400 text-sm"
                >
                  No keys issued yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <td className="px-4 py-2 text-slate-800 dark:text-slate-200">
                    {r.name}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {r.email}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {r.prefix}…
                  </td>
                  <td
                    className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400"
                    suppressHydrationWarning
                  >
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td
                    className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400"
                    suppressHydrationWarning
                  >
                    {r.last_used_at
                      ? new Date(r.last_used_at).toLocaleDateString()
                      : "—"}
                  </td>
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
                  <td className="px-4 py-2 text-right">
                    {!r.revoked_at ? (
                      <button
                        onClick={() => revoke(r.id)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Revoke
                      </button>
                    ) : null}
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
