import Link from "next/link";

import { ToplineCard } from "@/components/topline-card";
import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { formatDollars, formatNumber, formatPercent } from "@/lib/utils";

// FY27 data is still trickling in (most states adopt by Jun 30 2026, then
// PA/CA/TX/WA/IN/CT/KS through Aug-Nov). Revalidate hourly so the page
// stays fresh as extractor runs land new rows.
export const revalidate = 3600;

type RollupRow = Database["public"]["Views"]["v_fy27_rollup"]["Row"];

const BUCKET_ORDER: { id: string; label: string; tone: "good" | "warn" | "neutral" }[] = [
  { id: "lt_neg_10pct", label: "≤ −10%", tone: "warn" },
  { id: "neg_10_to_neg_5pct", label: "−5 to −10%", tone: "warn" },
  { id: "neg_5_to_0pct", label: "0 to −5%", tone: "neutral" },
  { id: "0_to_5pct", label: "0 to +5%", tone: "neutral" },
  { id: "5_to_10pct", label: "+5 to +10%", tone: "good" },
  { id: "gte_10pct", label: "≥ +10%", tone: "good" },
];

async function load() {
  const supabase = await getServerClient();
  const [rollupRes, calRes] = await Promise.all([
    supabase
      .from("v_fy27_rollup")
      .select("*"),
    supabase
      .from("state_calendars")
      .select("state_postal, fiscal_year, adoption_deadline")
      .eq("fiscal_year", 2027)
      .order("adoption_deadline", { ascending: true }),
  ]);

  const rows = (rollupRes.data ?? []) as RollupRow[];
  const calendars = calRes.data ?? [];
  return { rows, calendars };
}

export default async function FY27ReportPage() {
  const { rows, calendars } = await load();

  // Aggregate stats
  const total = rows.length;
  const withBaseline = rows.filter((r) => r.fy26_baseline_amount != null);
  const stateSet = new Set(
    rows.map((r) => r.state_postal).filter((s): s is string => !!s),
  );

  const fy27Total = rows.reduce((s, r) => s + (r.fy27_amount ?? 0), 0);
  const fy26Total = withBaseline.reduce(
    (s, r) => s + (r.fy26_baseline_amount ?? 0),
    0,
  );
  const aggregateDelta = fy26Total > 0 ? (fy27Total - fy26Total) / fy26Total * 100 : null;

  // Bucket distribution (only rows with baseline)
  const bucketCounts = new Map<string, number>();
  for (const r of withBaseline) {
    if (!r.change_bucket) continue;
    bucketCounts.set(r.change_bucket, (bucketCounts.get(r.change_bucket) ?? 0) + 1);
  }
  const maxBucket = Math.max(1, ...Array.from(bucketCounts.values()));

  // Per-state aggregates
  const byState = new Map<string, RollupRow[]>();
  for (const r of rows) {
    if (!r.state_postal) continue;
    const arr = byState.get(r.state_postal) ?? [];
    arr.push(r);
    byState.set(r.state_postal, arr);
  }
  const stateRows = Array.from(byState.entries())
    .map(([state, rs]) => {
      const fy27 = rs.reduce((s, r) => s + (r.fy27_amount ?? 0), 0);
      const fy26 = rs
        .filter((r) => r.fy26_baseline_amount != null)
        .reduce((s, r) => s + (r.fy26_baseline_amount ?? 0), 0);
      const withPct = rs
        .map((r) => r.pct_change)
        .filter((p): p is number => p != null)
        .sort((a, b) => a - b);
      const median =
        withPct.length === 0
          ? null
          : withPct[Math.floor(withPct.length / 2)];
      return { state, n: rs.length, fy27, fy26, median };
    })
    .sort((a, b) => b.fy27 - a.fy27);

  // Top-10 movers (require enrollment ≥1000 to avoid micro-district noise)
  const eligibleMovers = withBaseline
    .filter(
      (r) =>
        r.pct_change != null &&
        (r.enrollment_fy25 ?? 0) >= 1000,
    );
  const topGainers = [...eligibleMovers]
    .sort((a, b) => (b.pct_change ?? 0) - (a.pct_change ?? 0))
    .slice(0, 10);
  const topDecliners = [...eligibleMovers]
    .sort((a, b) => (a.pct_change ?? 0) - (b.pct_change ?? 0))
    .slice(0, 10);

  const today = new Date();
  const upcomingDeadlines = calendars.filter((c) => {
    if (!c.adoption_deadline) return false;
    return new Date(c.adoption_deadline) >= today;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
          Live report · updates as states close their adoption windows
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          FY27 national rollup
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Adopted budgets for the 2026-27 school year as districts close their
          board approval cycles. Each row compares to the prior fiscal year
          baseline (FY26 actual where audited, else FY26 board-adopted).
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <ToplineCard
          accent="primary"
          label="Districts reporting"
          value={formatNumber(total)}
          sublabel={`${stateSet.size} state${stateSet.size === 1 ? "" : "s"} live`}
        />
        <ToplineCard
          label="FY27 adopted (sum)"
          value={formatDollars(fy27Total, { forceUnit: "B" })}
          sublabel="of the ~$870B U.S. K-12 total"
        />
        <ToplineCard
          label="FY26 baseline (sum)"
          value={
            fy26Total > 0
              ? formatDollars(fy26Total, { forceUnit: "B" })
              : "—"
          }
          sublabel={
            withBaseline.length > 0
              ? `${formatNumber(withBaseline.length)} of ${formatNumber(total)} districts have a baseline`
              : "no baseline yet"
          }
        />
        <ToplineCard
          label="Aggregate change"
          value={
            aggregateDelta != null
              ? formatPercent(aggregateDelta, { signed: true })
              : "—"
          }
          sublabel={
            aggregateDelta != null && fy26Total > 0
              ? `${formatDollars(fy27Total - fy26Total, { forceUnit: "B" })} net`
              : "needs FY26 baseline"
          }
          accent={
            aggregateDelta != null && aggregateDelta < 0 ? "warn" : "default"
          }
        />
      </section>

      {total === 0 ? (
        <EmptyState upcomingDeadlines={upcomingDeadlines} />
      ) : (
        <>
          {withBaseline.length > 0 ? (
            <section className="mb-10 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Distribution of year-over-year change
              </h2>
              <div className="space-y-2">
                {BUCKET_ORDER.map((b) => {
                  const n = bucketCounts.get(b.id) ?? 0;
                  const pct = withBaseline.length > 0
                    ? (n / withBaseline.length) * 100
                    : 0;
                  const barColor =
                    b.tone === "warn"
                      ? "bg-red-500/70 dark:bg-red-500/60"
                      : b.tone === "good"
                        ? "bg-emerald-500/70 dark:bg-emerald-500/60"
                        : "bg-slate-400 dark:bg-slate-600";
                  return (
                    <div
                      key={b.id}
                      className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-sm"
                    >
                      <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                        {b.label}
                      </span>
                      <div className="h-5 rounded bg-slate-100 dark:bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full ${barColor}`}
                          style={{ width: `${(n / maxBucket) * 100}%` }}
                        />
                      </div>
                      <span className="text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(n)}{" "}
                        <span className="text-xs text-slate-500 dark:text-slate-500">
                          ({pct.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Across {formatNumber(withBaseline.length)} districts where we
                have both an FY26 baseline and an FY27 adopted budget.
              </p>
            </section>
          ) : null}

          <section className="mb-10">
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              By state
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left  px-3 py-2 font-medium">State</th>
                    <th className="text-right px-3 py-2 font-medium">Districts</th>
                    <th className="text-right px-3 py-2 font-medium">
                      FY27 adopted
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      FY26 baseline
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      Median % change
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stateRows.map((s) => (
                    <tr
                      key={s.state}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/states/${s.state}`}
                          className="font-mono text-xs text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          {s.state}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(s.n)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800 dark:text-slate-200">
                        {formatDollars(s.fy27, { forceUnit: "B" })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {s.fy26 > 0
                          ? formatDollars(s.fy26, { forceUnit: "B" })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.median != null ? (
                          <span
                            className={
                              s.median >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {formatPercent(s.median, { signed: true })}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {topGainers.length > 0 || topDecliners.length > 0 ? (
            <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {topGainers.length > 0 ? (
                <MoverTable
                  title="Top 10 gainers"
                  description="Districts ≥1,000 students, ranked by FY26→FY27 % change."
                  rows={topGainers}
                  positive
                />
              ) : null}
              {topDecliners.length > 0 ? (
                <MoverTable
                  title="Top 10 decliners"
                  description="Districts ≥1,000 students, ranked by FY26→FY27 % change."
                  rows={topDecliners}
                  positive={false}
                />
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <section className="mb-10 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Methodology &amp; caveats
        </h2>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc list-inside">
          <li>
            <strong>FY27 status:</strong> adopted (board-approved). State
            statutory adoption windows close between May 15 (NJ) and Nov 2026
            (KS, WI). This page picks up new districts as their state&apos;s
            extractor cron fires.
          </li>
          <li>
            <strong>Baseline:</strong> per LEA, we prefer FY26 actual once it
            publishes; until then we use FY26 adopted as the comparison frame.
            The view&apos;s <code className="font-mono text-xs">fy26_baseline_status</code> column makes
            this explicit.
          </li>
          <li>
            <strong>Frame:</strong> each state&apos;s topline uses its own
            authoritative definition (per-state methodology linked from{" "}
            <Link
              href="/methodology"
              className="text-sky-600 dark:text-sky-400 hover:underline"
            >
              /methodology
            </Link>
            ). Comparisons across states are most meaningful within the same{" "}
            <Link
              href="/rankings"
              className="text-sky-600 dark:text-sky-400 hover:underline"
            >
              coverage tier
            </Link>
            .
          </li>
          <li>
            <strong>Known coverage gaps:</strong> NYC DOE (separate filing,
            ~1.0M students), most charter LEAs, and 6 deferred states (NV, NM,
            AK, RI, DE, WY) are absent from this rollup.
          </li>
          <li>
            <strong>Movers filter:</strong> top-10 lists exclude districts
            under 1,000 students to dampen percentage-volatility in small LEAs.
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Press kit
        </h2>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
          Bulk downloads of the data behind this report. All CSV; cite as{" "}
          <em>School Spending Tracker, FY27 national rollup, retrieved{" "}
          {today.toISOString().slice(0, 10)}</em>.
        </p>
        <ul className="space-y-1.5 text-sm">
          <li>
            <a
              href="/api/v1/exports/fy27-rollup.csv"
              className="text-sky-600 dark:text-sky-400 hover:underline"
              download
            >
              FY27 rollup full table (one row per district)
            </a>
          </li>
          <li>
            <a
              href="/api/v1/exports/budget-events.csv?fiscal_year=2027&status=adopted"
              className="text-sky-600 dark:text-sky-400 hover:underline"
              download
            >
              FY27 adopted budget events (raw)
            </a>
          </li>
          <li>
            <a
              href="/api/v1/exports/budget-event-components.csv?fiscal_year=2027"
              className="text-sky-600 dark:text-sky-400 hover:underline"
              download
            >
              FY27 canonical-category components (where source separates)
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

function MoverTable({
  title,
  description,
  rows,
  positive,
}: {
  title: string;
  description: string;
  rows: RollupRow[];
  positive: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => (
            <tr
              key={r.leaid}
              className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
            >
              <td className="px-4 py-2">
                {r.leaid && r.state_postal ? (
                  <Link
                    href={`/states/${r.state_postal}/${r.leaid}`}
                    className="text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
                  >
                    {r.lea_name}
                  </Link>
                ) : (
                  r.lea_name
                )}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-500">
                  {r.state_postal}
                </span>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                <span
                  className={
                    positive
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-red-600 dark:text-red-400 font-medium"
                  }
                >
                  {r.pct_change != null
                    ? formatPercent(r.pct_change, { signed: true })
                    : "—"}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-500">
                  {formatDollars(r.dollar_change, { forceUnit: "M" })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  upcomingDeadlines,
}: {
  upcomingDeadlines: { state_postal: string; adoption_deadline: string | null }[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 mb-10">
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50 mb-2">
        FY27 adoption is still in progress
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Most states close their FY27 board adoption windows between mid-May
        and June 30 2026. Late states (PA, CA, TX, WA, IN, CT, KS) run through
        August–November. This page populates automatically as each state&apos;s
        extractor lands new rows.
      </p>
      {upcomingDeadlines.length > 0 ? (
        <>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-4 mb-2">
            Next deadlines
          </h3>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
            {upcomingDeadlines.slice(0, 10).map((d) => (
              <li key={d.state_postal}>
                <span className="font-mono text-xs">{d.state_postal}</span> ·{" "}
                {d.adoption_deadline}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
