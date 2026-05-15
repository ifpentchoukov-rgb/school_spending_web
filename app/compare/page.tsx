import Link from "next/link";

import {
  COMPARE_ROWS,
  MAX_LEAS,
  type PerPupilRow,
  getCompareValue,
  loadLatestForCompare,
  parseLeaIds,
} from "@/lib/compare-data";
import { formatNumber } from "@/lib/utils";

export const revalidate = 3600;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const leaids = parseLeaIds(
    typeof params.leaids === "string" ? params.leaids : undefined,
  );
  const rows = await loadLatestForCompare(leaids);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Compare districts
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Per-pupil canonical-category breakdown for up to {MAX_LEAS}{" "}
          districts side-by-side. Latest available actual FY for each district.
        </p>
      </header>

      {leaids.length === 0 ? (
        <EmptyState />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
          No matching events for the LEAs you supplied (
          <span className="font-mono">{leaids.join(", ")}</span>). Check the IDs
          and try again.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing latest available FY per district. A dash (—) means the
              source doesn&apos;t separate that category for that LEA — coverage
              gaps are honest, not zeros.
            </p>
            <a
              href={`/api/compare/csv?leaids=${leaids.join(",")}`}
              className="text-xs rounded border border-slate-200 dark:border-slate-700 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-900"
              download
            >
              Download CSV
            </a>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium w-1/5">
                    Category (per pupil)
                  </th>
                  {rows.map((r) => (
                    <th
                      key={r.budget_event_id ?? r.leaid}
                      className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-200"
                    >
                      <Link
                        href={`/states/${r.state_postal}/${r.leaid}`}
                        className="hover:text-sky-600 dark:hover:text-sky-400 text-sm font-medium block"
                      >
                        {r.lea_name}
                      </Link>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-500 font-normal">
                        {r.state_postal} · FY{(r.fiscal_year ?? 0) % 100} ·{" "}
                        {formatNumber(r.enrollment_fy25)} students
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {COMPARE_ROWS.filter((r) => r.group === "exp").map((meta) => (
                  <Row key={String(meta.key)} meta={meta} rows={rows} />
                ))}
                <tr className="bg-slate-100/60 dark:bg-slate-900/60">
                  <th
                    colSpan={rows.length + 1}
                    className="px-4 py-1.5 text-left text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium"
                  >
                    Revenue (where source separates)
                  </th>
                </tr>
                {COMPARE_ROWS.filter((r) => r.group === "rev").map((meta) => (
                  <Row key={String(meta.key)} meta={meta} rows={rows} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            <Link
              href="/search"
              className="text-sky-600 dark:text-sky-400 hover:underline"
            >
              Search for more districts
            </Link>{" "}
            to add to the comparison — copy the LEAID from any district page
            and append it to the <span className="font-mono">leaids</span>{" "}
            query parameter (comma-separated, max {MAX_LEAS}).
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  meta,
  rows,
}: {
  meta: { key: keyof PerPupilRow; label: string; emphasis?: boolean };
  rows: PerPupilRow[];
}) {
  const values = rows.map((r) => getCompareValue(r, meta.key));
  const maxVal = Math.max(0, ...values.map((v) => v ?? 0));
  const cellCls = meta.emphasis
    ? "font-semibold text-slate-900 dark:text-slate-50"
    : "text-slate-700 dark:text-slate-300";
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
      <th
        scope="row"
        className={`px-4 py-2 text-left font-normal text-sm ${
          meta.emphasis
            ? "text-slate-900 dark:text-slate-50 font-medium"
            : "text-slate-700 dark:text-slate-200"
        }`}
      >
        {meta.label}
      </th>
      {rows.map((r, i) => {
        const v = values[i];
        const isMax = v != null && v === maxVal && maxVal > 0;
        return (
          <td
            key={r.budget_event_id ?? `${r.leaid}-${String(meta.key)}`}
            className={`px-4 py-2 text-right tabular-nums text-sm ${cellCls} ${
              isMax && rows.length > 1
                ? "bg-sky-50 dark:bg-sky-950/30"
                : ""
            }`}
          >
            {v != null ? (
              `$${formatNumber(Math.round(v))}`
            ) : (
              <span className="text-slate-300 dark:text-slate-700">—</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8">
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50 mb-2">
        Pick up to {MAX_LEAS} districts
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Use the URL parameter{" "}
        <span className="font-mono">?leaids=A,B,C,D</span> with NCES LEAIDs.
        For now you can construct these by hand by visiting two or more
        district pages and copying their LEAID from the URL — a visual builder
        is on the roadmap.
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Example:{" "}
        <Link
          href="/compare?leaids=4823640,4832790,0691014,3604380"
          className="text-sky-600 dark:text-sky-400 hover:underline font-mono"
        >
          /compare?leaids=4823640,4832790,0691014,3604380
        </Link>{" "}
        compares Houston ISD (TX), Dallas ISD (TX), Los Angeles Unified (CA),
        and Buffalo City SD (NY).
      </p>
      <p className="mt-3 text-sm">
        <Link
          href="/search"
          className="text-sky-600 dark:text-sky-400 hover:underline"
        >
          Search for a district →
        </Link>
      </p>
    </div>
  );
}
