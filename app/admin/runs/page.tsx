import Link from "next/link";

import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";
import { RealtimeRunsList } from "./realtime-runs-list";

export const dynamic = "force-dynamic";

async function loadInitialRuns() {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("extraction_runs")
    .select(
      "id, extractor_name, status, started_at, finished_at, records_extracted, records_changed, triggered_by, error_summary",
    )
    .order("started_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export default async function RunsPage() {
  const initial = await loadInitialRuns();
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Extraction runs
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Live feed of all extractor invocations. New rows append as they
          happen — no refresh needed (subscribed to{" "}
          <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">
            postgres_changes
          </code>{" "}
          on{" "}
          <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">
            extraction_runs
          </code>
          ).
        </p>
      </header>
      <RealtimeRunsList initial={initial} />
      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Showing the latest {Math.min(50, initial.length)} runs (then live
        updates). Older runs available via{" "}
        <Link
          href="/admin/runs?older=true"
          className="text-sky-600 hover:underline dark:text-sky-400"
        >
          paginated history →
        </Link>{" "}
        (TODO).
      </p>
    </div>
  );
}
