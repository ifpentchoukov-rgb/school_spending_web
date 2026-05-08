import Link from "next/link";
import { notFound } from "next/navigation";

import { ToplineCard } from "@/components/topline-card";
import { getStateMeta } from "@/lib/state-meta";
import { getServerClient } from "@/lib/supabase/server";
import { formatDollars, formatNumber, formatPercent } from "@/lib/utils";
import type { Database } from "@/lib/types";

// Per-state data refreshes daily by default; on-demand revalidate fires
// when /api/revalidate gets a webhook for any LEA in this state.
export const revalidate = 86400;

type CoverageRow = {
  state_postal: string | null;
  fiscal_year: number | null;
  status: string | null;
  n_leas: number | null;
  n_leas_verified: number | null;
  total_amount: number | null;
};

type District = Database["public"]["Tables"]["districts"]["Row"];
type Calendar = Database["public"]["Tables"]["state_calendars"]["Row"];
type Event = Database["public"]["Tables"]["budget_events"]["Row"];
type SourceDoc = Database["public"]["Tables"]["source_documents"]["Row"];

type LeaRow = {
  district: District;
  latestActual: Event | null;
  latestAdopted: Event | null;
};

async function loadStatePage(postal: string) {
  const supabase = await getServerClient();

  const [
    { data: districts },
    coverageRes,
    { data: calendars },
  ] = await Promise.all([
    supabase
      .from("districts")
      .select("*")
      .eq("state_postal", postal)
      .eq("is_operating_district", true)
      .order("enrollment_fy25", { ascending: false, nullsFirst: false }),
    supabase
      .from("v_state_fy_coverage")
      .select(
        "state_postal, fiscal_year, status, n_leas, n_leas_verified, total_amount",
      )
      .eq("state_postal", postal)
      .returns<CoverageRow[]>(),
    supabase
      .from("state_calendars")
      .select("*")
      .eq("state_postal", postal)
      .order("fiscal_year", { ascending: false }),
  ]);

  if (!districts || districts.length === 0) {
    return null;
  }

  const leaids = districts.map((d) => d.leaid);

  // Fetch events + source_documents, paginating to handle large states.
  const allEvents: Event[] = [];
  const pageSize = 1000;
  for (let from = 0; from < leaids.length; from += pageSize) {
    const slice = leaids.slice(from, from + pageSize);
    const { data: chunk } = await supabase
      .from("budget_events")
      .select("*")
      .in("leaid", slice)
      .eq("is_superseded", false);
    if (chunk) allEvents.push(...chunk);
  }

  const sourceIds = Array.from(
    new Set(allEvents.map((e) => e.source_document_id).filter(Boolean)),
  );
  let sourceDocs: SourceDoc[] = [];
  if (sourceIds.length > 0) {
    const { data: docs } = await supabase
      .from("source_documents")
      .select("*")
      .in("id", sourceIds);
    sourceDocs = docs ?? [];
  }
  const sourceById = new Map(sourceDocs.map((s) => [s.id, s]));

  // Roll events up per LEA → latest (actual, adopted) per LEA.
  const eventsByLea = new Map<string, { actual: Event[]; adopted: Event[] }>();
  for (const e of allEvents) {
    const cur = eventsByLea.get(e.leaid) ?? { actual: [], adopted: [] };
    if (e.status === "actual") cur.actual.push(e);
    else if (e.status === "adopted") cur.adopted.push(e);
    eventsByLea.set(e.leaid, cur);
  }
  const pickLatest = (xs: Event[]) =>
    xs.sort((a, b) => b.fiscal_year - a.fiscal_year)[0] ?? null;

  const leaRows: LeaRow[] = districts.map((d) => {
    const entry = eventsByLea.get(d.leaid);
    return {
      district: d,
      latestActual: entry ? pickLatest(entry.actual) : null,
      latestAdopted: entry ? pickLatest(entry.adopted) : null,
    };
  });

  return {
    districts,
    leaRows,
    coverage: coverageRes.data ?? [],
    calendars: calendars ?? [],
    sourceById,
    eventCount: allEvents.length,
  };
}

export default async function StatePage({
  params,
}: {
  params: Promise<{ postal: string }>;
}) {
  const { postal: rawPostal } = await params;
  const postal = rawPostal.toUpperCase();
  const meta = getStateMeta(postal);
  if (!meta) notFound();

  const data = await loadStatePage(postal);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-8">
          <Link
            href="/states"
            className="text-xs text-sky-600 hover:underline dark:text-sky-400"
          >
            ← All states
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {meta.name}{" "}
            <span className="font-mono text-base text-slate-500 dark:text-slate-400">
              {meta.postal}
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            ~{formatNumber(meta.enrollment)} K-12 students.{" "}
            <span className="inline-block rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
              Deferred
            </span>{" "}
            — no extractor live yet.
          </p>
        </header>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-600 dark:text-slate-400">
          We have not yet ingested per-LEA spending data for {meta.name}. See{" "}
          <Link
            href="/methodology"
            className="text-sky-600 hover:underline dark:text-sky-400"
          >
            methodology
          </Link>{" "}
          for our investigation status of each deferred state.
        </div>
      </div>
    );
  }

  const totalActual = data.coverage
    .filter((c) => c.status === "actual")
    .reduce((s, c) => s + Number(c.total_amount ?? 0), 0);
  const totalAdopted = data.coverage
    .filter((c) => c.status === "adopted")
    .reduce((s, c) => s + Number(c.total_amount ?? 0), 0);

  // Latest FYs across statuses
  const latestActualFy = Math.max(
    0,
    ...data.coverage.filter((c) => c.status === "actual").map((c) => c.fiscal_year ?? 0),
  );
  const latestAdoptedFy = Math.max(
    0,
    ...data.coverage.filter((c) => c.status === "adopted").map((c) => c.fiscal_year ?? 0),
  );

  // Coverage timeline rows (fy x status)
  const coverageByFy = new Map<number, { actual?: CoverageRow; adopted?: CoverageRow }>();
  for (const c of data.coverage) {
    if (!c.fiscal_year) continue;
    const cur = coverageByFy.get(c.fiscal_year) ?? {};
    if (c.status === "actual") cur.actual = c;
    else if (c.status === "adopted") cur.adopted = c;
    coverageByFy.set(c.fiscal_year, cur);
  }
  const fyRows = Array.from(coverageByFy.entries()).sort(
    ([a], [b]) => b - a,
  );

  // Pick a representative source-document for the explainer ("how we collect")
  // — the most recent one referenced by any current event.
  const explainerSource = Array.from(data.sourceById.values()).sort((a, b) =>
    (b.fetched_at ?? "").localeCompare(a.fetched_at ?? ""),
  )[0];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <Link
          href="/states"
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          ← All states
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {meta.name}{" "}
          <span className="font-mono text-base text-slate-500 dark:text-slate-400">
            {meta.postal}
          </span>
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          ~{formatNumber(meta.enrollment)} K-12 students ·{" "}
          {data.districts.length} operating LEAs in our master ·{" "}
          {data.eventCount} budget events tracked
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <ToplineCard
          accent="primary"
          label="Latest actuals"
          value={
            latestActualFy
              ? `FY${latestActualFy % 100}`
              : "—"
          }
          sublabel={
            latestActualFy
              ? `${formatDollars(totalActual, { forceUnit: "B" })} across all FYs tracked`
              : "no actuals ingested"
          }
        />
        <ToplineCard
          label="Latest adopted"
          value={
            latestAdoptedFy
              ? `FY${latestAdoptedFy % 100}`
              : "—"
          }
          sublabel={
            latestAdoptedFy
              ? `${formatDollars(totalAdopted, { forceUnit: "B" })} across all FYs tracked`
              : "no adopted-budget pipeline"
          }
        />
        <ToplineCard
          label="LEAs covered"
          value={`${formatNumber(data.districts.length)}`}
          sublabel="operating districts in our master list"
        />
      </section>

      <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Coverage timeline
          </h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left py-2 font-medium">FY</th>
                <th className="text-left py-2 font-medium">Actual</th>
                <th className="text-right py-2 font-medium">$</th>
                <th className="text-left py-2 font-medium">Adopted</th>
                <th className="text-right py-2 font-medium">$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {fyRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500 dark:text-slate-400">
                    No budget events yet.
                  </td>
                </tr>
              ) : (
                fyRows.map(([fy, c]) => (
                  <tr key={fy}>
                    <td className="py-2 font-mono text-slate-700 dark:text-slate-300">
                      FY{fy % 100}
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-400">
                      {c.actual
                        ? `${c.actual.n_leas}/${data.districts.length} LEAs`
                        : <span className="text-slate-400 dark:text-slate-600">—</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {c.actual
                        ? formatDollars(c.actual.total_amount, { forceUnit: "B" })
                        : <span className="text-slate-400 dark:text-slate-600">—</span>}
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-400">
                      {c.adopted
                        ? `${c.adopted.n_leas}/${data.districts.length} LEAs`
                        : <span className="text-slate-400 dark:text-slate-600">—</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {c.adopted
                        ? formatDollars(c.adopted.total_amount, { forceUnit: "B" })
                        : <span className="text-slate-400 dark:text-slate-600">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            How we collect this state's data
          </h2>
          {explainerSource ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Publisher</dt>
                <dd className="text-slate-700 dark:text-slate-300">
                  {explainerSource.publisher ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Document type</dt>
                <dd className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  {explainerSource.document_type ?? "—"}
                </dd>
              </div>
              {explainerSource.line_or_cell_reference ? (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    Topline reference
                  </dt>
                  <dd className="text-slate-700 dark:text-slate-300">
                    {explainerSource.line_or_cell_reference}
                  </dd>
                </div>
              ) : null}
              {explainerSource.source_url ? (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Source URL</dt>
                  <dd className="break-all text-xs">
                    <a
                      href={explainerSource.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline dark:text-sky-400"
                    >
                      {explainerSource.source_url.length > 80
                        ? explainerSource.source_url.slice(0, 77) + "..."
                        : explainerSource.source_url}
                    </a>
                  </dd>
                </div>
              ) : null}
              {explainerSource.notes ? (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Notes</dt>
                  <dd className="text-slate-600 dark:text-slate-400 text-xs">
                    {explainerSource.notes}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No source documents for this state yet.
            </p>
          )}
          {data.calendars.length > 0 ? (
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Adoption deadlines
              </h3>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {data.calendars.slice(0, 3).map((c) => (
                  <li key={c.fiscal_year} className="flex justify-between">
                    <span>FY{c.fiscal_year % 100}:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {c.adoption_deadline ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Per-LEA detail ({formatNumber(data.leaRows.length)})
        </h2>
        <LeaTable rows={data.leaRows} statePostal={meta.postal} />
      </section>
    </div>
  );
}

function LeaTable({
  rows,
  statePostal,
}: {
  rows: LeaRow[];
  statePostal: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-[60vh]">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0">
          <tr>
            <th className="text-left px-4 py-2 font-medium">LEA</th>
            <th className="text-right px-4 py-2 font-medium">Enrollment</th>
            <th className="text-left px-4 py-2 font-medium">Latest actual</th>
            <th className="text-right px-4 py-2 font-medium">$</th>
            <th className="text-right px-4 py-2 font-medium">YoY</th>
            <th className="text-left px-4 py-2 font-medium">Latest adopted</th>
            <th className="text-right px-4 py-2 font-medium">$</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map(({ district, latestActual, latestAdopted }) => (
            <tr key={district.leaid} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
              <td className="px-4 py-2">
                <Link
                  href={`/states/${statePostal}/${district.leaid}`}
                  className="text-slate-900 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400"
                >
                  {district.lea_name}
                </Link>
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {formatNumber(district.enrollment_fy25)}
              </td>
              <td className="px-4 py-2">
                {latestActual ? (
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    FY{latestActual.fiscal_year % 100}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {latestActual
                  ? formatDollars(latestActual.topline_amount, { forceUnit: "M" })
                  : <span className="text-slate-400 dark:text-slate-600">—</span>}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {latestActual?.yoy_change_pct != null ? (
                  <span
                    className={
                      latestActual.yoy_change_pct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {formatPercent(latestActual.yoy_change_pct, { signed: true })}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-600">—</span>
                )}
              </td>
              <td className="px-4 py-2">
                {latestAdopted ? (
                  <span className="inline-block rounded bg-sky-100 dark:bg-sky-900/40 px-1.5 py-0.5 text-xs font-mono text-sky-700 dark:text-sky-300">
                    FY{latestAdopted.fiscal_year % 100}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {latestAdopted
                  ? formatDollars(latestAdopted.topline_amount, { forceUnit: "M" })
                  : <span className="text-slate-400 dark:text-slate-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
