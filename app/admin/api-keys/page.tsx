import Link from "next/link";

import { getServiceRoleClient } from "@/lib/supabase/server";

import { KeyManager, type KeyRow } from "./key-manager";

export const dynamic = "force-dynamic";

async function loadKeys(): Promise<KeyRow[]> {
  const supabase = getServiceRoleClient();

  // Pull every key with the issuing user's email joined in.
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, prefix, user_id, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  if (!keys || keys.length === 0) return [];

  // Resolve user_id → email via service-role admin API. listUsers is
  // paginated; at v1 scale (<100 users) one page covers it.
  const { data: usersPage } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailByUserId = new Map(
    (usersPage?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  return keys.map((k) => ({
    ...k,
    email: emailByUserId.get(k.user_id) ?? "(unknown user)",
  }));
}

export default async function ApiKeysPage() {
  const keys = await loadKeys();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <Link
          href="/admin"
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          ← Admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          API keys
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Issue opaque bearer keys (prefix <code className="font-mono text-xs">ssk_</code>)
          to allowlisted researchers and admins. Keys inherit the
          issuee&apos;s tier at request time — revoking the allowlist entry
          downgrades all of that user&apos;s keys automatically. Each key is
          displayed once at creation; the underlying value is sha256-hashed
          before storage so it can&apos;t be recovered later.
        </p>
      </header>

      <KeyManager initial={keys} />

      <section className="mt-10 rounded-lg border border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-700 dark:text-slate-300">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Usage
        </h2>
        <p className="mb-2">A key is used like any Bearer token:</p>
        <pre className="text-xs bg-slate-100 dark:bg-slate-900 rounded p-3 overflow-x-auto">
{`curl -H "Authorization: Bearer ssk_XXXXXXXX..." \\
  https://school-spending-web.vercel.app/api/v1/budget-events?state=TX&fiscal_year=2025`}
        </pre>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Limits: anonymous 60 rpm / 500 max page size · researcher 600 rpm /
          5000 max · admin unlimited. Enforced via Vercel KV; 429 responses
          carry a <code className="font-mono">Retry-After</code> header.
        </p>
      </section>
    </div>
  );
}
