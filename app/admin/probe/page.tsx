import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProbeResult = {
  state: string;
  fiscal_year: number;
  status: string;
  module: string;
  hit_url: string | null;
  size: number;
  status_code: number;
  note: string;
};

export default async function ProbePage() {
  const supabase = await getServerClient();
  const { data: probes } = await supabase
    .from("probe_runs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(20);

  const latest = probes?.[0] ?? null;
  const latestResults = (latest?.results as { results?: ProbeResult[] })?.results ?? [];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Probe history
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Output of <code>scripts/probe_new_files.py</code>. Each run probes
          a small registry of likely-soon-published state files; hits are
          surfaced here and can be auto-applied.
        </p>
      </header>

      {!probes || probes.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400">
          No probe runs yet. Run{" "}
          <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">
            python scripts/probe_new_files.py
          </code>{" "}
          (in the sister Python repo) to populate this view. The script can be
          modified to write into the <code>probe_runs</code> table on each
          execution; the row appears here automatically.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Recent runs
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-2">When</th>
                    <th className="text-left px-4 py-2">Trigger</th>
                    <th className="text-right px-4 py-2">Hits</th>
                    <th className="text-right px-4 py-2">Misses</th>
                    <th className="text-left px-4 py-2">Applied?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {probes.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    >
                      <td
                        className="px-4 py-2 text-xs"
                        suppressHydrationWarning
                      >
                        {new Date(p.ran_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-xs">{p.triggered_by}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatNumber(p.n_hits)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {formatNumber(p.n_misses)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {p.applied ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {latestResults.length > 0 ? (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Latest probe results ({latestResults.length} targets)
              </h2>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="text-left px-4 py-2">State</th>
                      <th className="text-left px-4 py-2">FY</th>
                      <th className="text-left px-4 py-2">Kind</th>
                      <th className="text-left px-4 py-2">Result</th>
                      <th className="text-left px-4 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {latestResults.map((r, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                      >
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs font-semibold inline-flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 w-9 h-6">
                            {r.state}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          FY{r.fiscal_year % 100}
                        </td>
                        <td className="px-4 py-2 text-xs">{r.status}</td>
                        <td className="px-4 py-2 text-xs">
                          {r.hit_url ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              ✓ HIT
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">
                              {r.status_code === 200
                                ? "200/non-data"
                                : r.status_code
                                  ? `HTTP ${r.status_code}`
                                  : "miss"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {r.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
