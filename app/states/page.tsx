import Link from "next/link";

import { STATE_META, type StateMeta } from "@/lib/state-meta";
import { getServerClient } from "@/lib/supabase/server";
import { formatDollars, formatNumber } from "@/lib/utils";

// State coverage refreshes hourly; on-demand via revalidateTag("states-index").
export const revalidate = 3600;

type CoverageRow = {
  state_postal: string | null;
  fiscal_year: number | null;
  status: string | null;
  n_leas: number | null;
  total_amount: number | null;
};

type StateRow = StateMeta & {
  latestActualFy: number | null;
  latestActualTotal: number;
  latestAdoptedFy: number | null;
  latestAdoptedTotal: number;
  totalLeas: number;
  hasData: boolean;
};

async function loadStates(): Promise<StateRow[]> {
  const supabase = await getServerClient();
  const { data: coverage } = await supabase
    .from("v_state_fy_coverage")
    .select("state_postal, fiscal_year, status, n_leas, total_amount")
    .returns<CoverageRow[]>();

  // Group coverage by state and pick the latest FY per status.
  const byState = new Map<
    string,
    {
      latestActualFy: number | null;
      latestActualTotal: number;
      latestAdoptedFy: number | null;
      latestAdoptedTotal: number;
      totalLeas: number;
    }
  >();

  for (const row of coverage ?? []) {
    if (!row.state_postal) continue;
    const cur = byState.get(row.state_postal) ?? {
      latestActualFy: null,
      latestActualTotal: 0,
      latestAdoptedFy: null,
      latestAdoptedTotal: 0,
      totalLeas: 0,
    };
    const amount = Number(row.total_amount ?? 0);
    if (row.status === "actual") {
      if ((row.fiscal_year ?? 0) > (cur.latestActualFy ?? 0)) {
        cur.latestActualFy = row.fiscal_year;
        cur.latestActualTotal = amount;
        cur.totalLeas = row.n_leas ?? 0;
      }
    } else if (row.status === "adopted") {
      if ((row.fiscal_year ?? 0) > (cur.latestAdoptedFy ?? 0)) {
        cur.latestAdoptedFy = row.fiscal_year;
        cur.latestAdoptedTotal = amount;
        if (cur.totalLeas === 0) cur.totalLeas = row.n_leas ?? 0;
      }
    }
    byState.set(row.state_postal, cur);
  }

  return STATE_META.map((meta) => {
    const cov = byState.get(meta.postal);
    return {
      ...meta,
      latestActualFy: cov?.latestActualFy ?? null,
      latestActualTotal: cov?.latestActualTotal ?? 0,
      latestAdoptedFy: cov?.latestAdoptedFy ?? null,
      latestAdoptedTotal: cov?.latestAdoptedTotal ?? 0,
      totalLeas: cov?.totalLeas ?? 0,
      hasData: !!cov,
    };
  });
}

export default async function StatesPage() {
  const rows = await loadStates();
  const live = rows.filter((r) => r.hasData);
  const deferred = rows.filter((r) => !r.hasData);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          All states
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {live.length} live · {deferred.length} deferred · 51 jurisdictions
          total. Click a row for per-LEA detail.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Live ({live.length})
        </h2>
        <StateTable rows={live} />
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Deferred ({deferred.length})
        </h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Investigated but not yet ingested. Reasons range from no public bulk
          file (NY, AK), to Looker/Tableau-only dashboards (NM, RI), to
          publication lag (DE).
        </p>
        <StateTable rows={deferred} dimmed />
      </section>
    </div>
  );
}

function StateTable({ rows, dimmed = false }: { rows: StateRow[]; dimmed?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr>
            <th className="text-left px-4 py-2 font-medium">State</th>
            <th className="text-right px-4 py-2 font-medium">Enrollment</th>
            <th className="text-left px-4 py-2 font-medium">Latest actual</th>
            <th className="text-right px-4 py-2 font-medium">Total $</th>
            <th className="text-left px-4 py-2 font-medium">Latest adopted</th>
            <th className="text-right px-4 py-2 font-medium">Total $</th>
            <th className="text-right px-4 py-2 font-medium">LEAs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => (
            <tr
              key={r.postal}
              className={`group ${
                dimmed
                  ? "bg-slate-50/40 dark:bg-slate-900/30"
                  : "hover:bg-slate-50 dark:hover:bg-slate-900/40"
              }`}
            >
              <td className="px-4 py-2.5">
                <Link
                  href={`/states/${r.postal}`}
                  className="flex items-center gap-2 text-slate-900 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400"
                >
                  <span className="font-mono text-xs font-semibold inline-flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 w-9 h-6">
                    {r.postal}
                  </span>
                  <span className={dimmed ? "text-slate-500 dark:text-slate-400" : ""}>
                    {r.name}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {formatNumber(r.enrollment)}
              </td>
              <td className="px-4 py-2.5">
                {r.latestActualFy ? (
                  <span className="inline-block rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                    FY{r.latestActualFy % 100}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {r.latestActualTotal > 0 ? (
                  formatDollars(r.latestActualTotal, { forceUnit: "B" })
                ) : (
                  <span className="text-slate-400 dark:text-slate-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {r.latestAdoptedFy ? (
                  <span className="inline-block rounded bg-sky-100 dark:bg-sky-900/40 px-1.5 py-0.5 text-xs font-mono text-sky-700 dark:text-sky-300">
                    FY{r.latestAdoptedFy % 100}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {r.latestAdoptedTotal > 0 ? (
                  formatDollars(r.latestAdoptedTotal, { forceUnit: "B" })
                ) : (
                  <span className="text-slate-400 dark:text-slate-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {r.totalLeas > 0 ? formatNumber(r.totalLeas) : <span className="text-slate-400 dark:text-slate-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
