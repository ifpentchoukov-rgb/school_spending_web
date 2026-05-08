import Link from "next/link";
import { notFound } from "next/navigation";

import extractorDocs from "@/lib/extractor-docs.json";
import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

import { TriggerForm } from "./trigger-form";

export const dynamic = "force-dynamic";

type ExtractorDoc = {
  module: string;
  sourceFile: string;
  state: string | null;
  publisher: string | null;
  documentType: string | null;
  sourcePortalUrl: string | null;
  toplineDefinition: string | null;
  docstring: string;
  summary: string;
};

const docs = extractorDocs as Record<string, ExtractorDoc>;

export default async function ExtractorDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const doc = docs[decoded] ?? docs[decoded.replace(/^extractors\./, "")];
  if (!doc) notFound();

  const supabase = await getServerClient();
  const [{ data: runs }, { data: triggers }] = await Promise.all([
    supabase
      .from("extraction_runs")
      .select(
        "id, status, started_at, finished_at, records_extracted, records_changed, triggered_by, error_summary",
      )
      .eq("extractor_name", decoded)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("extractor_triggers")
      .select("*")
      .eq("module", doc.module)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <Link
        href="/admin/extractors"
        className="text-xs text-sky-600 hover:underline dark:text-sky-400"
      >
        ← All extractors
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
        <span className="font-mono">{doc.module}</span>
        {doc.state ? (
          <span className="ml-3 inline-block font-mono text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 align-middle">
            {doc.state}
          </span>
        ) : null}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {doc.summary}
      </p>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-5 space-y-3 text-sm">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Documentation
          </h2>
          {doc.publisher ? (
            <Field label="Publisher" value={doc.publisher} />
          ) : null}
          {doc.documentType ? (
            <Field label="Document type" value={doc.documentType} mono />
          ) : null}
          {doc.sourcePortalUrl ? (
            <Field
              label="Source portal"
              value={
                <a
                  href={doc.sourcePortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline dark:text-sky-400 break-all"
                >
                  {doc.sourcePortalUrl}
                </a>
              }
            />
          ) : null}
          {doc.toplineDefinition ? (
            <Field label="Topline" value={doc.toplineDefinition} />
          ) : null}
          <Field label="Source file" value={doc.sourceFile} mono />
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Trigger run
          </h2>
          <TriggerForm module={doc.module} />
          {triggers && triggers.length > 0 ? (
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Recent triggers
              </h3>
              <ul className="text-xs space-y-1">
                {triggers.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      FY{t.fiscal_year ?? "—"}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t.status}
                    </span>
                    <span
                      className="text-slate-400 dark:text-slate-600"
                      suppressHydrationWarning
                    >
                      {new Date(t.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Run history
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Extracted</th>
                <th className="text-right px-4 py-2 font-medium">Changed</th>
                <th className="text-left px-4 py-2 font-medium">Trigger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(runs ?? []).map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <td
                    className="px-4 py-2 text-xs"
                    suppressHydrationWarning
                  >
                    <Link
                      href={`/admin/runs/${r.id}`}
                      className="text-sky-600 hover:underline dark:text-sky-400"
                    >
                      {new Date(r.started_at).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">{r.status}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(r.records_extracted)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(r.records_changed)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {r.triggered_by}
                  </td>
                </tr>
              ))}
              {!runs || runs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400 text-sm"
                  >
                    No runs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-1 ${mono ? "font-mono text-xs" : ""} text-slate-700 dark:text-slate-300`}
      >
        {value}
      </dd>
    </div>
  );
}
