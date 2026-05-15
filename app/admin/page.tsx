import Link from "next/link";

import { ToplineCard } from "@/components/topline-card";
import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadAdminStats() {
  const supabase = await getServerClient();
  const [
    { count: totalEvents },
    { count: unverified },
    { count: verified },
    { count: flagged },
    { data: recentRuns },
    { count: pendingTriggers },
  ] = await Promise.all([
    supabase
      .from("budget_events")
      .select("*", { count: "exact", head: true })
      .eq("is_superseded", false),
    supabase
      .from("budget_events")
      .select("*", { count: "exact", head: true })
      .eq("is_superseded", false)
      .eq("verification_status", "unverified"),
    supabase
      .from("budget_events")
      .select("*", { count: "exact", head: true })
      .eq("is_superseded", false)
      .eq("verification_status", "verified"),
    supabase
      .from("budget_events")
      .select("*", { count: "exact", head: true })
      .eq("is_superseded", false)
      .eq("verification_status", "flagged"),
    supabase
      .from("extraction_runs")
      .select("id, extractor_name, status, started_at, records_changed")
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("extractor_triggers")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "dispatched", "running"]),
  ]);

  return {
    totalEvents: totalEvents ?? 0,
    unverified: unverified ?? 0,
    verified: verified ?? 0,
    flagged: flagged ?? 0,
    pendingTriggers: pendingTriggers ?? 0,
    recentRuns: recentRuns ?? [],
  };
}

export default async function AdminDashboard() {
  const s = await loadAdminStats();

  const verifiedPct =
    s.totalEvents > 0 ? (s.verified / s.totalEvents) * 100 : 0;

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Researcher dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Verify events, trigger extractors, and watch runs as they happen.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <ToplineCard
          accent="primary"
          label="Current events"
          value={formatNumber(s.totalEvents)}
          sublabel="non-superseded budget_events rows"
        />
        <ToplineCard
          label="Verified"
          value={`${formatNumber(s.verified)}`}
          sublabel={`${verifiedPct.toFixed(1)}% of events`}
        />
        <ToplineCard
          accent={s.flagged > 0 ? "warn" : "default"}
          label="Flagged"
          value={`${formatNumber(s.flagged)}`}
          sublabel="needs review"
        />
        <ToplineCard
          label="Pending triggers"
          value={`${formatNumber(s.pendingTriggers)}`}
          sublabel="extractor runs queued or in flight"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Recent runs
            </h2>
            <Link
              href="/admin/runs"
              className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              All runs →
            </Link>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {s.recentRuns.map((r) => (
              <li
                key={r.id}
                className="py-2 flex items-baseline justify-between gap-2"
              >
                <Link
                  href={`/admin/runs/${r.id}`}
                  className="font-mono truncate text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
                >
                  {r.extractor_name}
                </Link>
                <span className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      r.status === "success"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : r.status === "failed"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="tabular-nums">
                    {formatNumber(r.records_changed ?? 0)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Quick actions
          </h2>
          <ul className="text-sm space-y-2">
            <li>
              <Link
                href="/admin/extractors"
                className="text-sky-600 hover:underline dark:text-sky-400"
              >
                → Trigger an extractor
              </Link>
            </li>
            <li>
              <Link
                href="/admin/probe"
                className="text-sky-600 hover:underline dark:text-sky-400"
              >
                → Run the probe for new state files
              </Link>
            </li>
            <li>
              <Link
                href="/admin/runs"
                className="text-sky-600 hover:underline dark:text-sky-400"
              >
                → Watch live runs (Realtime)
              </Link>
            </li>
            <li>
              <Link
                href="/admin/users"
                className="text-sky-600 hover:underline dark:text-sky-400"
              >
                → Manage researcher allowlist
              </Link>
            </li>
            <li>
              <Link
                href="/admin/api-keys"
                className="text-sky-600 hover:underline dark:text-sky-400"
              >
                → Issue / revoke API keys
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
