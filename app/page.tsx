import Link from "next/link";

import { ToplineCard } from "@/components/topline-card";
import { getServerClient } from "@/lib/supabase/server";
import { formatDollars, formatNumber, formatPercent } from "@/lib/utils";

// Coverage stats refresh hourly. The webhook handler at /api/revalidate
// calls revalidateTag("coverage-dashboard") for sub-minute refresh when
// extractors land new data.
export const revalidate = 3600;

const TOTAL_US_K12_ENROLLMENT = 44_800_000;

type DashboardSummary = {
  n_live_states: number | null;
  covered_enrollment: number | null;
  fy25_n_leas: number | null;
  fy25_total: number | null;
  fy26_n_leas: number | null;
  fy26_total: number | null;
  n_adopted_pipelines: number | null;
};

type CoverageRow = {
  state_postal: string | null;
  fiscal_year: number | null;
  status: string | null;
  n_leas: number | null;
  total_amount: number | null;
};

async function loadDashboard() {
  const supabase = await getServerClient();

  const [summaryRes, runsRes, coverageRes] = await Promise.all([
    supabase
      .from("v_dashboard_summary")
      .select("*")
      .returns<DashboardSummary[]>()
      .maybeSingle(),
    supabase
      .from("extraction_runs")
      .select("id, extractor_name, status, started_at, records_changed")
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("v_state_fy_coverage")
      .select("state_postal, fiscal_year, status, n_leas, total_amount")
      .returns<CoverageRow[]>(),
  ]);

  const summary = (summaryRes.data ?? null) as DashboardSummary | null;
  const coverage = (coverageRes.data ?? []) as CoverageRow[];

  const liveStates = new Set(
    coverage.map((r) => r.state_postal).filter(Boolean) as string[],
  );

  return {
    summary,
    liveStateCount: liveStates.size,
    recentRuns: runsRes.data ?? [],
    coverage,
  };
}

export default async function HomePage() {
  const d = await loadDashboard();
  const s = d.summary;

  const coveredEnrollment = s?.covered_enrollment ?? 0;
  const pctCovered = coveredEnrollment / TOTAL_US_K12_ENROLLMENT;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          U.S. School District Spending — live coverage
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Per-LEA budget and actual expenditure data sourced directly from
          state Departments of Education and Census F-33 reporting. Updates
          automatically as new state files land.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <ToplineCard
          accent="primary"
          label="States live"
          value={`${s?.n_live_states ?? 0} + DC`}
          sublabel={`${formatPercent(pctCovered * 100, { precision: 1 })} of US K-12 enrollment covered`}
        />
        <ToplineCard
          label="FY25 actuals"
          value={formatDollars(s?.fy25_total ?? 0, { forceUnit: "B" })}
          sublabel={`${formatNumber(s?.fy25_n_leas ?? 0)} LEAs reporting`}
        />
        <ToplineCard
          label="FY26 adopted"
          value={formatDollars(s?.fy26_total ?? 0, { forceUnit: "B" })}
          sublabel={`${formatNumber(s?.fy26_n_leas ?? 0)} LEAs reporting`}
        />
        <ToplineCard
          label="Adopted-budget pipelines"
          value={`${s?.n_adopted_pipelines ?? 0}`}
          sublabel="states with real-time adopted-budget feeds"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Recent extraction runs
          </h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {d.recentRuns.length === 0 ? (
              <li className="py-3 text-sm text-slate-600 dark:text-slate-400">
                No runs recorded yet.
              </li>
            ) : (
              d.recentRuns.map((run) => (
                <li
                  key={run.id}
                  className="py-2 flex items-center justify-between text-sm gap-3"
                >
                  <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                    {run.extractor_name}
                  </span>
                  <span className="flex items-center gap-3 text-slate-500 dark:text-slate-400 shrink-0">
                    <RunStatusBadge status={run.status} />
                    <span className="tabular-nums">
                      {formatNumber(run.records_changed)} changed
                    </span>
                    <span suppressHydrationWarning>
                      {new Date(run.started_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ul>
          <Link
            href="/admin/runs"
            className="mt-3 inline-block text-xs text-sky-600 hover:underline dark:text-sky-400"
          >
            View all runs →
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            What this site shows
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-200">
                Two statuses, side by side
              </dt>
              <dd className="text-slate-600 dark:text-slate-400">
                Adopted budgets (forward-looking, as boards approve them) and
                audited actuals (post-FY, the canonical record).
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-200">
                Source-document provenance
              </dt>
              <dd className="text-slate-600 dark:text-slate-400">
                Every event links back to the exact PDF / XLSX / CSV the data
                came from, with content-hash and line / cell reference.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-200">
                Auto-updates as new data lands
              </dt>
              <dd className="text-slate-600 dark:text-slate-400">
                Scheduled extractors run daily; the site refreshes within
                seconds of any new budget event being written.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Live states ({d.liveStateCount})
          </h2>
          <Link
            href="/states"
            className="text-xs text-sky-600 hover:underline dark:text-sky-400"
          >
            View full index →
          </Link>
        </div>
        <StatePillGrid coverage={d.coverage} />
      </section>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "failed"
        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}

function StatePillGrid({ coverage }: { coverage: CoverageRow[] }) {
  // Roll up: per state, what's the latest actual and latest adopted FY?
  const byState = new Map<
    string,
    { latestActualFy: number | null; latestAdoptedFy: number | null; total: number }
  >();
  for (const row of coverage) {
    if (!row.state_postal) continue;
    const cur = byState.get(row.state_postal) ?? {
      latestActualFy: null,
      latestAdoptedFy: null,
      total: 0,
    };
    if (row.status === "actual") {
      cur.latestActualFy = Math.max(cur.latestActualFy ?? 0, row.fiscal_year ?? 0);
    } else if (row.status === "adopted") {
      cur.latestAdoptedFy = Math.max(cur.latestAdoptedFy ?? 0, row.fiscal_year ?? 0);
    }
    cur.total += Number(row.total_amount ?? 0);
    byState.set(row.state_postal, cur);
  }
  const states = Array.from(byState.entries())
    .map(([postal, info]) => ({ postal, ...info }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {states.map((s) => (
        <Link
          key={s.postal}
          href={`/states/${s.postal}`}
          className="rounded-md border border-slate-200 dark:border-slate-800 p-3 hover:border-sky-400 hover:bg-sky-50/50 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 transition-colors"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {s.postal}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {formatDollars(s.total, { forceUnit: "B" })}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-2 mt-1">
            {s.latestActualFy ? <span>FY{s.latestActualFy % 100} actual</span> : null}
            {s.latestAdoptedFy ? (
              <span className="text-sky-600 dark:text-sky-400">
                FY{s.latestAdoptedFy % 100} adopted
              </span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
