import Link from "next/link";

import { getStateMeta } from "@/lib/state-meta";
import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { formatDollars, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 3600;

type PerPupilRow =
  Database["public"]["Views"]["v_per_pupil_metrics"]["Row"];
type TierRow =
  Database["public"]["Tables"]["state_extractor_metadata"]["Row"];

// Each metric maps to a column in v_per_pupil_metrics. label is the
// dropdown label; column is the column to ORDER BY; sub describes what
// it measures so users understand apples-to-apples vs apples-to-oranges.
const METRICS = [
  {
    id: "topline_per_pupil",
    label: "Total per-pupil",
    column: "topline_per_pupil",
    sub: "Operating spend ÷ enrollment. Every live state.",
  },
  {
    id: "instruction_per_pupil",
    label: "Instruction per-pupil",
    column: "instruction_per_pupil",
    sub: "Function 1XXX salaries + benefits + supplies. Where source separates.",
  },
  {
    id: "administration_per_pupil",
    label: "Administration per-pupil",
    column: "administration_per_pupil",
    sub: "District + school admin. Where source separates.",
  },
  {
    id: "debt_service_per_pupil",
    label: "Debt service per-pupil",
    column: "debt_service_per_pupil",
    sub: "Principal + interest. Where reported separately.",
  },
  {
    id: "capital_outlay_per_pupil",
    label: "Capital outlay per-pupil",
    column: "capital_outlay_per_pupil",
    sub: "New construction + equipment.",
  },
  {
    id: "employee_benefits_per_pupil",
    label: "Employee benefits per-pupil",
    column: "employee_benefits_per_pupil",
    sub: "FICA + pensions + health. Where source separates.",
  },
  {
    id: "food_service_per_pupil",
    label: "Food service per-pupil",
    column: "food_service_per_pupil",
    sub: "Cafeteria operations.",
  },
  {
    id: "yoy_change_pct",
    label: "YoY change %",
    column: "yoy_change_pct",
    sub: "Most-recent FY actual vs prior FY actual.",
  },
] as const;

const BANDS = [
  { id: "all", label: "All sizes", min: 0, max: Number.POSITIVE_INFINITY },
  { id: "mega", label: "≥ 50k students", min: 50000, max: Number.POSITIVE_INFINITY },
  { id: "large", label: "10k – 50k", min: 10000, max: 50000 },
  { id: "mid", label: "2k – 10k", min: 2000, max: 10000 },
  { id: "small", label: "< 2k", min: 0, max: 2000 },
] as const;

const ORDER = ["desc", "asc"] as const;

const PAGE_SIZE = 50;

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const metricId =
    typeof searchParams.metric === "string"
      ? searchParams.metric
      : "topline_per_pupil";
  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];
  const state =
    typeof searchParams.state === "string" && searchParams.state.length === 2
      ? searchParams.state.toUpperCase()
      : "ALL";
  const bandId = typeof searchParams.band === "string" ? searchParams.band : "all";
  const band = BANDS.find((b) => b.id === bandId) ?? BANDS[0];
  const fy = typeof searchParams.fy === "string" ? Number(searchParams.fy) : NaN;
  const order =
    typeof searchParams.order === "string" &&
    (ORDER as readonly string[]).includes(searchParams.order)
      ? (searchParams.order as (typeof ORDER)[number])
      : "desc";
  const page =
    typeof searchParams.page === "string" ? Math.max(1, Number(searchParams.page)) : 1;
  return { metric, state, band, fy, order, page };
}

async function loadRankings(
  metricCol: string,
  state: string,
  band: { min: number; max: number },
  fy: number | undefined,
  order: "asc" | "desc",
  page: number,
) {
  const supabase = await getServerClient();

  // Resolve "latest available" FY when none specified, scoped to current
  // filter set. Use status=actual as the canonical comparison base.
  let resolvedFy = fy;
  if (!resolvedFy || Number.isNaN(resolvedFy)) {
    const latestQ = supabase
      .from("v_per_pupil_metrics")
      .select("fiscal_year")
      .eq("status", "actual")
      .order("fiscal_year", { ascending: false })
      .limit(1);
    const { data } = state !== "ALL"
      ? await latestQ.eq("state_postal", state)
      : await latestQ;
    resolvedFy = data?.[0]?.fiscal_year ?? 2024;
  }

  let query = supabase
    .from("v_per_pupil_metrics")
    .select("*", { count: "exact" })
    .eq("status", "actual")
    .eq("fiscal_year", resolvedFy)
    .eq("is_operating_district", true)
    .not(metricCol, "is", null)
    .order(metricCol, { ascending: order === "asc", nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (state !== "ALL") query = query.eq("state_postal", state);
  if (band.min > 0) query = query.gte("enrollment_fy25", band.min);
  if (band.max !== Number.POSITIVE_INFINITY)
    query = query.lt("enrollment_fy25", band.max);

  const { data: rows, count } = await query;

  // Pull tier badges for the states present in the result set.
  const stateSet = new Set((rows ?? []).map((r) => r.state_postal).filter(Boolean) as string[]);
  let tiers: TierRow[] = [];
  if (stateSet.size > 0) {
    const { data } = await supabase
      .from("state_extractor_metadata")
      .select("*")
      .in("state_postal", Array.from(stateSet));
    tiers = data ?? [];
  }
  const tierByState = new Map(tiers.map((t) => [t.state_postal, t]));

  return { rows: rows ?? [], total: count ?? 0, resolvedFy, tierByState };
}

function qs(
  base: { metric: string; state: string; band: string; fy: number; order: string; page: number },
  override: Partial<typeof base>,
) {
  const merged = { ...base, ...override };
  const params = new URLSearchParams();
  if (merged.metric !== "topline_per_pupil") params.set("metric", merged.metric);
  if (merged.state !== "ALL") params.set("state", merged.state);
  if (merged.band !== "all") params.set("band", merged.band);
  if (merged.fy) params.set("fy", String(merged.fy));
  if (merged.order !== "desc") params.set("order", merged.order);
  if (merged.page !== 1) params.set("page", String(merged.page));
  const s = params.toString();
  return s ? `/rankings?${s}` : "/rankings";
}

const STATE_LIST: { postal: string; name: string }[] = [
  { postal: "ALL", name: "All states" },
  { postal: "AL", name: "Alabama" }, { postal: "AZ", name: "Arizona" },
  { postal: "AR", name: "Arkansas" }, { postal: "CA", name: "California" },
  { postal: "CO", name: "Colorado" }, { postal: "CT", name: "Connecticut" },
  { postal: "DC", name: "DC" }, { postal: "FL", name: "Florida" },
  { postal: "GA", name: "Georgia" }, { postal: "HI", name: "Hawaii" },
  { postal: "ID", name: "Idaho" }, { postal: "IL", name: "Illinois" },
  { postal: "IN", name: "Indiana" }, { postal: "IA", name: "Iowa" },
  { postal: "KS", name: "Kansas" }, { postal: "KY", name: "Kentucky" },
  { postal: "LA", name: "Louisiana" }, { postal: "ME", name: "Maine" },
  { postal: "MD", name: "Maryland" }, { postal: "MA", name: "Massachusetts" },
  { postal: "MI", name: "Michigan" }, { postal: "MN", name: "Minnesota" },
  { postal: "MS", name: "Mississippi" }, { postal: "MO", name: "Missouri" },
  { postal: "MT", name: "Montana" }, { postal: "NE", name: "Nebraska" },
  { postal: "NH", name: "New Hampshire" }, { postal: "NJ", name: "New Jersey" },
  { postal: "NY", name: "New York" }, { postal: "NC", name: "North Carolina" },
  { postal: "ND", name: "North Dakota" }, { postal: "OH", name: "Ohio" },
  { postal: "OK", name: "Oklahoma" }, { postal: "OR", name: "Oregon" },
  { postal: "PA", name: "Pennsylvania" }, { postal: "SC", name: "South Carolina" },
  { postal: "SD", name: "South Dakota" }, { postal: "TN", name: "Tennessee" },
  { postal: "TX", name: "Texas" }, { postal: "UT", name: "Utah" },
  { postal: "VT", name: "Vermont" }, { postal: "VA", name: "Virginia" },
  { postal: "WA", name: "Washington" }, { postal: "WV", name: "West Virginia" },
  { postal: "WI", name: "Wisconsin" },
];

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { metric, state, band, fy, order, page } = parseParams(params);

  const { rows, total, resolvedFy, tierByState } = await loadRankings(
    metric.column,
    state,
    band,
    fy,
    order,
    page,
  );

  const base = {
    metric: metric.id,
    state,
    band: band.id,
    fy: resolvedFy,
    order,
    page,
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          District rankings
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Sortable national rankings of {formatNumber(total)} districts on FY{" "}
          {resolvedFy % 100} actuals by{" "}
          <span className="font-medium">{metric.label.toLowerCase()}</span>.{" "}
          {metric.sub}
        </p>
      </header>

      <form
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 rounded-lg border border-slate-200 dark:border-slate-800 p-4"
        action="/rankings"
        method="get"
      >
        <label className="text-sm">
          <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            Metric
          </span>
          <select
            name="metric"
            defaultValue={metric.id}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            State
          </span>
          <select
            name="state"
            defaultValue={state}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
          >
            {STATE_LIST.map((s) => (
              <option key={s.postal} value={s.postal}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            Enrollment
          </span>
          <select
            name="band"
            defaultValue={band.id}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
          >
            {BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            Order
          </span>
          <select
            name="order"
            defaultValue={order}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
          >
            <option value="desc">Highest first</option>
            <option value="asc">Lowest first</option>
          </select>
        </label>
        <div className="col-span-2 sm:col-span-4 flex items-center justify-between gap-2">
          <button
            type="submit"
            className="rounded bg-sky-600 hover:bg-sky-700 text-white text-sm px-3 py-1.5"
          >
            Apply
          </button>
          {state !== "ALL" || band.id !== "all" || metric.id !== "topline_per_pupil" || order !== "desc" ? (
            <Link
              href="/rankings"
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
            >
              Reset filters
            </Link>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
          No districts match these filters. The selected metric is likely
          unavailable for the chosen state — try a different metric or a
          different state.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-right px-3 py-2 font-medium w-12">Rank</th>
                  <th className="text-left  px-4 py-2 font-medium">District</th>
                  <th className="text-left  px-3 py-2 font-medium w-14">State</th>
                  <th className="text-right px-3 py-2 font-medium">
                    Enrollment
                  </th>
                  <th className="text-right px-3 py-2 font-medium">
                    {metric.label}
                  </th>
                  <th className="text-left px-3 py-2 font-medium">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((row: PerPupilRow, i: number) => {
                  const rank = (page - 1) * PAGE_SIZE + i + 1;
                  const tier = row.state_postal
                    ? tierByState.get(row.state_postal)
                    : null;
                  const value = (row as unknown as Record<string, number | null>)[
                    metric.column
                  ];
                  return (
                    <tr
                      key={row.budget_event_id ?? `${row.leaid}-${row.fiscal_year}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {rank}
                      </td>
                      <td className="px-4 py-2">
                        {row.leaid && row.state_postal ? (
                          <Link
                            href={`/states/${row.state_postal}/${row.leaid}`}
                            className="text-slate-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400"
                          >
                            {row.lea_name}
                          </Link>
                        ) : (
                          row.lea_name
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {row.state_postal}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {formatNumber(row.enrollment_fy25)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-200">
                        {metric.id === "yoy_change_pct"
                          ? value != null
                            ? (
                                <span
                                  className={
                                    value >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-red-600 dark:text-red-400"
                                  }
                                >
                                  {formatPercent(value, { signed: true })}
                                </span>
                              )
                            : "—"
                          : value != null
                            ? `$${formatNumber(Math.round(value))}`
                            : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {tier ? <TierBadge tier={tier} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav
              className="mt-4 flex items-center justify-between text-sm"
              aria-label="Pagination"
            >
              <span className="text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages} · {formatNumber(total)} districts
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={qs(base, { page: page - 1 })}
                    className="rounded border border-slate-200 dark:border-slate-700 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    ← Prev
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={qs(base, { page: page + 1 })}
                    className="rounded border border-slate-200 dark:border-slate-700 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Tier badges reflect how richly the state&apos;s source data lets us
        standardize categories. <span className="font-medium">Rich</span> = 7+
        canonical categories extractable; <span className="font-medium">
          moderate
        </span>{" "}
        = 2–5; <span className="font-medium">thin</span> = topline only. Compare
        within tiers for the cleanest apples-to-apples. See{" "}
        <Link
          href="/methodology"
          className="text-sky-600 dark:text-sky-400 hover:underline"
        >
          methodology
        </Link>{" "}
        for source definitions.
      </p>
    </div>
  );
}

function TierBadge({ tier }: { tier: TierRow }) {
  const styles: Record<string, string> = {
    rich: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    moderate: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    thin: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    deferred: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <span
      title={tier.tier_rationale ?? undefined}
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
        styles[tier.coverage_tier] ?? styles.deferred
      }`}
    >
      {tier.coverage_tier}
    </span>
  );
}
