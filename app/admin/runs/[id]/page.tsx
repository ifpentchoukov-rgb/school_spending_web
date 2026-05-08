import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerClient();
  const { data: run } = await supabase
    .from("extraction_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();

  const { count: eventsChanged } = await supabase
    .from("budget_events")
    .select("*", { count: "exact", head: true })
    .eq("extraction_run_id", id);

  return (
    <div>
      <Link
        href="/admin/runs"
        className="text-xs text-sky-600 hover:underline dark:text-sky-400"
      >
        ← All runs
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
        Run {run.id.slice(0, 8)}
        <span className="ml-3 font-mono text-base text-slate-500 dark:text-slate-400">
          {run.extractor_name}
        </span>
      </h1>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Status" value={run.status} mono />
        <Field label="Trigger" value={run.triggered_by} mono />
        <Field
          label="Started"
          value={new Date(run.started_at).toLocaleString()}
        />
        {run.finished_at ? (
          <Field
            label="Finished"
            value={new Date(run.finished_at).toLocaleString()}
          />
        ) : null}
        <Field
          label="Records extracted"
          value={formatNumber(run.records_extracted)}
        />
        <Field
          label="Records changed"
          value={formatNumber(run.records_changed)}
        />
        <Field
          label="Events touching this run"
          value={formatNumber(eventsChanged ?? 0)}
        />
        <Field label="Git commit" value={run.git_commit_sha?.slice(0, 12) ?? "—"} mono />
      </dl>

      {run.error_summary ? (
        <div className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wider text-red-600 dark:text-red-400 mb-2">
            Error
          </h2>
          <pre className="whitespace-pre-wrap rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-4 text-xs text-red-800 dark:text-red-300">
            {run.error_summary}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
      <dt className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm ${mono ? "font-mono" : ""} text-slate-700 dark:text-slate-300`}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
