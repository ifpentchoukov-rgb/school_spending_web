import { getServerClient } from "@/lib/supabase/server";

import { AllowlistManager } from "./allowlist-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await getServerClient();
  const { data: rows } = await supabase
    .from("researcher_allowlist")
    .select("*")
    .order("invited_at", { ascending: false });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Researcher allowlist
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Invite-only researcher access. Add an email here; on next sign-in
          (magic link) the user is granted{" "}
          <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">
            app_metadata.role = 'researcher'
          </code>
          . Revoke by clicking the row's revoke action — the user retains
          their session until next refresh, but RLS cuts off any verifier
          actions immediately.
        </p>
      </header>

      <AllowlistManager initial={rows ?? []} />
    </div>
  );
}
