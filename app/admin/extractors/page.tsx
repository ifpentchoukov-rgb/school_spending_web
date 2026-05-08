import Link from "next/link";

import extractorDocs from "@/lib/extractor-docs.json";
import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ExtractorDoc = {
  module: string;
  state: string | null;
  publisher: string | null;
  documentType: string | null;
  summary: string;
};

const docs = extractorDocs as Record<string, ExtractorDoc>;

async function loadLastRunsByExtractor() {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("extraction_runs")
    .select("extractor_name, status, started_at, records_changed")
    .order("started_at", { ascending: false })
    .limit(500);
  const byName = new Map<
    string,
    { status: string; started_at: string; records_changed: number | null }
  >();
  for (const r of data ?? []) {
    if (!byName.has(r.extractor_name)) {
      byName.set(r.extractor_name, {
        status: r.status,
        started_at: r.started_at,
        records_changed: r.records_changed,
      });
    }
  }
  return byName;
}

export default async function ExtractorsPage() {
  const lastByName = await loadLastRunsByExtractor();
  const rows = Object.entries(docs)
    .filter(([, d]) => d.state)
    .map(([key, d]) => ({
      key,
      ...d,
      lastRun: lastByName.get(key) ?? null,
    }))
    .sort((a, b) => {
      const sa = a.state ?? "";
      const sb = b.state ?? "";
      if (sa !== sb) return sa.localeCompare(sb);
      return a.key.localeCompare(b.key);
    });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Extractors
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {rows.length} extractors registered. Click any row to see details
          and trigger a run.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">State</th>
              <th className="text-left px-4 py-2 font-medium">Module</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-left px-4 py-2 font-medium">Last run</th>
              <th className="text-right px-4 py-2 font-medium">Changed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((r) => (
              <tr
                key={r.key}
                className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
              >
                <td className="px-4 py-2">
                  <span className="font-mono text-xs font-semibold inline-flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 w-9 h-6">
                    {r.state}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/extractors/${encodeURIComponent(r.key)}`}
                    className="font-mono text-xs text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
                  >
                    {r.module}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 max-w-md truncate">
                  {r.summary}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.lastRun ? (
                    <span className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          r.lastRun.status === "success"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : r.lastRun.status === "failed"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                      >
                        {r.lastRun.status}
                      </span>
                      <span
                        className="text-slate-500 dark:text-slate-400"
                        suppressHydrationWarning
                      >
                        {new Date(r.lastRun.started_at).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-500 dark:text-slate-400">
                  {r.lastRun?.records_changed != null
                    ? formatNumber(r.lastRun.records_changed)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
