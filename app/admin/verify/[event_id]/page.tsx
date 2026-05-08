import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerClient } from "@/lib/supabase/server";
import { formatDollars, formatPercent } from "@/lib/utils";

import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ event_id: string }>;
}) {
  const { event_id } = await params;
  const supabase = await getServerClient();

  const [{ data: event }, { data: log }] = await Promise.all([
    supabase
      .from("budget_events")
      .select("*")
      .eq("id", event_id)
      .maybeSingle(),
    supabase
      .from("verification_log")
      .select("*")
      .eq("budget_event_id", event_id)
      .order("created_at", { ascending: false }),
  ]);

  if (!event) notFound();

  const [{ data: district }, { data: source }] = await Promise.all([
    supabase
      .from("districts")
      .select("*")
      .eq("leaid", event.leaid)
      .maybeSingle(),
    supabase
      .from("source_documents")
      .select("*")
      .eq("id", event.source_document_id)
      .maybeSingle(),
  ]);

  const sourcePath = source?.storage_path ?? null;
  // Build a public Storage URL. Storage objects are publicly readable
  // for now; in Phase B we'd route through sign-source-doc instead.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sourceObjectUrl = sourcePath
    ? `${supabaseUrl}/storage/v1/object/public/${sourcePath}`
    : null;

  return (
    <div>
      <Link
        href="/admin"
        className="text-xs text-sky-600 hover:underline dark:text-sky-400"
      >
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
        Verify event{" "}
        <span className="font-mono text-base text-slate-500 dark:text-slate-400">
          {event.id.slice(0, 8)}
        </span>
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {district?.lea_name}{" "}
        {district?.state_postal ? `(${district.state_postal})` : null} ·{" "}
        FY{event.fiscal_year % 100} {event.status}
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left pane — parsed values */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Parsed by extractor
            </h2>
            <dl className="space-y-3 text-sm">
              <Field
                label="Topline"
                value={formatDollars(event.topline_amount, { forceUnit: "M" })}
                strong
              />
              <Field
                label="YoY change"
                value={
                  event.yoy_change_pct != null
                    ? formatPercent(event.yoy_change_pct, { signed: true })
                    : "—"
                }
              />
              <Field
                label="Status"
                value={event.status}
                mono
              />
              <Field
                label="Verification status"
                value={event.verification_status}
                mono
              />
              {event.topline_definition ? (
                <Field
                  label="Topline definition"
                  value={event.topline_definition}
                />
              ) : null}
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Verification action
            </h2>
            <VerifyForm
              eventId={event.id}
              parsedValue={event.topline_amount}
              currentStatus={event.verification_status}
            />
          </div>

          {log && log.length > 0 ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Audit trail
              </h2>
              <ul className="text-xs space-y-2">
                {log.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-l-2 border-slate-200 dark:border-slate-700 pl-3"
                  >
                    <div className="text-slate-700 dark:text-slate-300">
                      <span className="font-mono">{entry.actor}</span> ·{" "}
                      <strong>{entry.action}</strong>
                    </div>
                    {entry.previous_status || entry.new_status ? (
                      <div className="text-slate-500 dark:text-slate-400">
                        {entry.previous_status ?? "—"} →{" "}
                        {entry.new_status ?? "—"}
                      </div>
                    ) : null}
                    {entry.notes ? (
                      <div className="mt-1 text-slate-600 dark:text-slate-400">
                        {entry.notes}
                      </div>
                    ) : null}
                    <div
                      className="mt-1 text-slate-400 dark:text-slate-600"
                      suppressHydrationWarning
                    >
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Right pane — source document */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Source document
          </h2>
          {source ? (
            <dl className="space-y-3 text-sm mb-4">
              <Field label="Publisher" value={source.publisher ?? "—"} />
              <Field
                label="Document type"
                value={source.document_type ?? "—"}
                mono
              />
              {source.line_or_cell_reference ? (
                <Field
                  label="Topline reference"
                  value={source.line_or_cell_reference}
                />
              ) : null}
              {source.content_hash_sha256 ? (
                <Field
                  label="SHA-256"
                  value={source.content_hash_sha256.slice(0, 24) + "…"}
                  mono
                />
              ) : null}
              {source.source_url ? (
                <Field
                  label="Original URL"
                  value={
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline dark:text-sky-400 break-all"
                    >
                      {source.source_url.length > 70
                        ? source.source_url.slice(0, 67) + "…"
                        : source.source_url}
                    </a>
                  }
                />
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No source document linked.
            </p>
          )}
          {sourceObjectUrl ? (
            <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
              <iframe
                src={sourceObjectUrl}
                title="Source document"
                className="w-full h-[600px]"
              />
              <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 truncate">
                  {source?.storage_path}
                </span>
                <a
                  href={sourceObjectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline dark:text-sky-400 shrink-0 ml-2"
                >
                  Open ↗
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm ${mono ? "font-mono text-xs" : ""} ${
          strong ? "text-2xl font-semibold tabular-nums" : ""
        } text-slate-700 dark:text-slate-300`}
      >
        {value}
      </dd>
    </div>
  );
}
