import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryBreakdown } from "@/components/category-breakdown";
import { ToplineCard } from "@/components/topline-card";
import { getStateMeta } from "@/lib/state-meta";
import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { formatDollars, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 86400;

type District = Database["public"]["Tables"]["districts"]["Row"];
type Event = Database["public"]["Tables"]["budget_events"]["Row"];
type SourceDoc = Database["public"]["Tables"]["source_documents"]["Row"];
type Component = Database["public"]["Tables"]["budget_event_components"]["Row"];
type StateMeta = Database["public"]["Tables"]["state_extractor_metadata"]["Row"];

async function loadLea(postal: string, leaid: string) {
  const supabase = await getServerClient();

  const [{ data: district }, { data: events }, { data: tierRow }] =
    await Promise.all([
      supabase
        .from("districts")
        .select("*")
        .eq("leaid", leaid)
        .eq("state_postal", postal)
        .maybeSingle(),
      supabase
        .from("budget_events")
        .select("*")
        .eq("leaid", leaid)
        .order("fiscal_year", { ascending: true }),
      supabase
        .from("state_extractor_metadata")
        .select("*")
        .eq("state_postal", postal)
        .maybeSingle(),
    ]);

  if (!district) return null;

  const sourceIds = Array.from(
    new Set((events ?? []).map((e) => e.source_document_id).filter(Boolean)),
  );
  let sources: SourceDoc[] = [];
  if (sourceIds.length > 0) {
    const { data } = await supabase
      .from("source_documents")
      .select("*")
      .in("id", sourceIds);
    sources = data ?? [];
  }
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  // Components for this LEA's non-superseded events (Phase 9.4).
  const eventIds = (events ?? [])
    .filter((e) => !e.is_superseded)
    .map((e) => e.id);
  let components: Component[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from("budget_event_components")
      .select("*")
      .in("budget_event_id", eventIds);
    components = data ?? [];
  }

  // Peer LEAs — 5 closest by enrollment in same state.
  const peerEnrollment = district.enrollment_fy25 ?? 0;
  const { data: peerDistricts } = await supabase
    .from("districts")
    .select("leaid, lea_name, enrollment_fy25, state_postal")
    .eq("state_postal", postal)
    .eq("is_operating_district", true)
    .neq("leaid", leaid)
    .not("enrollment_fy25", "is", null);

  const peerCandidates = (peerDistricts ?? [])
    .filter((p) => p.enrollment_fy25 != null)
    .sort(
      (a, b) =>
        Math.abs((a.enrollment_fy25 ?? 0) - peerEnrollment) -
        Math.abs((b.enrollment_fy25 ?? 0) - peerEnrollment),
    )
    .slice(0, 5);

  // Pull latest topline for each peer for comparison.
  const peerLeaids = peerCandidates.map((p) => p.leaid);
  let peerEvents: Event[] = [];
  if (peerLeaids.length > 0) {
    const { data } = await supabase
      .from("budget_events")
      .select("*")
      .in("leaid", peerLeaids)
      .eq("is_superseded", false)
      .eq("status", "actual");
    peerEvents = data ?? [];
  }
  const peerLatestByLea = new Map<string, Event>();
  for (const e of peerEvents) {
    const cur = peerLatestByLea.get(e.leaid);
    if (!cur || e.fiscal_year > cur.fiscal_year) {
      peerLatestByLea.set(e.leaid, e);
    }
  }
  const peers = peerCandidates.map((p) => ({
    ...p,
    latestActual: peerLatestByLea.get(p.leaid) ?? null,
  }));

  return {
    district,
    events: events ?? [],
    sourceById,
    peers,
    components,
    tier: tierRow ?? null,
  };
}

export default async function LeaPage({
  params,
}: {
  params: Promise<{ postal: string; leaid: string }>;
}) {
  const { postal: rawPostal, leaid } = await params;
  const postal = rawPostal.toUpperCase();
  const meta = getStateMeta(postal);
  if (!meta) notFound();

  const data = await loadLea(postal, leaid);
  if (!data) notFound();

  const { district, events, sourceById, peers, components, tier } = data;
  const currentEvents = events.filter((e) => !e.is_superseded);
  const latestActual = pickLatestByStatus(currentEvents, "actual");
  const latestAdopted = pickLatestByStatus(currentEvents, "adopted");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <Link
          href={`/states/${postal}`}
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          ← {meta.name}
        </Link>
        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {district.lea_name}
          </h1>
          {tier ? <CoverageTierBadge tier={tier} /> : null}
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-mono">{district.leaid}</span>
          {district.state_leaid ? (
            <>
              {" · "}
              <span className="font-mono">{district.state_leaid}</span>
            </>
          ) : null}
          {district.county_name ? (
            <>
              {" · "}
              {district.county_name} County
            </>
          ) : null}
          {district.enrollment_fy25 ? (
            <>
              {" · "}
              {formatNumber(district.enrollment_fy25)} students (FY25)
            </>
          ) : null}
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <ToplineCard
          accent="primary"
          label="Latest actual"
          value={
            latestActual
              ? formatDollars(latestActual.topline_amount, { forceUnit: "M" })
              : "—"
          }
          sublabel={
            latestActual
              ? `FY${latestActual.fiscal_year % 100}${
                  latestActual.yoy_change_pct != null
                    ? ` · ${formatPercent(latestActual.yoy_change_pct, {
                        signed: true,
                      })} YoY`
                    : ""
                }`
              : "no actuals tracked"
          }
        />
        <ToplineCard
          label="Latest adopted"
          value={
            latestAdopted
              ? formatDollars(latestAdopted.topline_amount, { forceUnit: "M" })
              : "—"
          }
          sublabel={
            latestAdopted
              ? `FY${latestAdopted.fiscal_year % 100} board-approved`
              : "no adopted-budget pipeline"
          }
        />
        <ToplineCard
          label="Per-pupil (latest actual)"
          value={
            latestActual && district.enrollment_fy25
              ? `$${formatNumber(
                  Math.round(
                    latestActual.topline_amount / district.enrollment_fy25,
                  ),
                )}`
              : "—"
          }
          sublabel={
            latestActual && district.enrollment_fy25
              ? `${formatDollars(latestActual.topline_amount, { forceUnit: "M" })} ÷ ${formatNumber(district.enrollment_fy25)}`
              : ""
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Time series
          </h2>
          <TimeSeriesChart events={currentEvents} />
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Peer LEAs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Closest five by enrollment in {meta.name}.
          </p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {peers.map((p) => (
              <li
                key={p.leaid}
                className="py-2 flex items-baseline justify-between gap-2"
              >
                <Link
                  href={`/states/${postal}/${p.leaid}`}
                  className="truncate text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
                >
                  {p.lea_name}
                </Link>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                  {formatNumber(p.enrollment_fy25)} ·{" "}
                  {p.latestActual
                    ? formatDollars(p.latestActual.topline_amount, {
                        forceUnit: "M",
                      })
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          All events ({currentEvents.length} current
          {events.length > currentEvents.length
            ? ` · ${events.length - currentEvents.length} superseded`
            : ""})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">FY</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Topline</th>
                <th className="text-right px-4 py-2 font-medium">YoY</th>
                <th className="text-left px-4 py-2 font-medium">Source</th>
                <th className="text-left px-4 py-2 font-medium">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {currentEvents
                .slice()
                .sort((a, b) => b.fiscal_year - a.fiscal_year)
                .map((e) => {
                  const src = sourceById.get(e.source_document_id);
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-4 py-2 font-mono text-slate-700 dark:text-slate-300">
                        FY{e.fiscal_year % 100}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatDollars(e.topline_amount, { forceUnit: "M" })}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {e.yoy_change_pct != null ? (
                          <span
                            className={
                              e.yoy_change_pct >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {formatPercent(e.yoy_change_pct, { signed: true })}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 max-w-md">
                        {src ? (
                          <SourceCell src={src} />
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <VerificationBadge status={e.verification_status} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {components.length > 0 ? (
        <section className="mb-10">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Category breakdown
            </h2>
            <Link
              href="/methodology"
              className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              What does this mean? →
            </Link>
          </div>
          <CategoryBreakdown
            events={currentEvents}
            components={components}
            enrollment={district.enrollment_fy25}
          />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Categories are standardized across states from each source&apos;s
            chart of accounts. A dash (—) means the source doesn&apos;t
            separate that category — see the topline definition below for
            what is included.
          </p>
        </section>
      ) : null}

      {latestActual?.topline_definition || latestAdopted?.topline_definition ? (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-5 mb-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            What the topline includes
          </h2>
          <dl className="space-y-3 text-sm">
            {latestActual?.topline_definition ? (
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Actual (FY{latestActual.fiscal_year % 100})
                </dt>
                <dd className="text-slate-700 dark:text-slate-300">
                  {latestActual.topline_definition}
                </dd>
              </div>
            ) : null}
            {latestAdopted?.topline_definition &&
            latestAdopted.topline_definition !==
              latestActual?.topline_definition ? (
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Adopted (FY{latestAdopted.fiscal_year % 100})
                </dt>
                <dd className="text-slate-700 dark:text-slate-300">
                  {latestAdopted.topline_definition}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function pickLatestByStatus(events: Event[], status: string): Event | null {
  const filtered = events.filter((e) => e.status === status);
  if (filtered.length === 0) return null;
  return filtered.reduce((max, e) =>
    e.fiscal_year > max.fiscal_year ? e : max,
  );
}

function CoverageTierBadge({ tier }: { tier: StateMeta }) {
  // rich = 7+ canonical categories extractable; moderate = 2-5; thin = 1
  // (topline only); deferred = no extractor yet. Phase 7.3 classification.
  const t = tier.coverage_tier;
  const styles: Record<string, string> = {
    rich: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    moderate: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    thin: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    deferred:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  const label: Record<string, string> = {
    rich: "Rich detail",
    moderate: "Moderate detail",
    thin: "Topline only",
    deferred: "Source deferred",
  };
  return (
    <span
      title={tier.tier_rationale ?? undefined}
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        styles[t] ?? styles.deferred
      }`}
    >
      {label[t] ?? t}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "adopted"
      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
      : status === "actual"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        ✓ verified
      </span>
    );
  }
  if (status === "flagged" || status === "disputed") {
    return (
      <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        ⚠ {status}
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-400 dark:text-slate-600">
      unverified
    </span>
  );
}

function SourceCell({ src }: { src: SourceDoc }) {
  return (
    <div className="text-xs">
      <div className="text-slate-700 dark:text-slate-300 truncate">
        {src.publisher ?? src.document_type ?? "source"}
      </div>
      {src.source_url ? (
        <a
          href={src.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:underline dark:text-sky-400 truncate inline-block max-w-full"
        >
          {(() => {
            try {
              const u = new URL(src.source_url);
              return u.hostname + u.pathname;
            } catch {
              return src.source_url;
            }
          })()}
        </a>
      ) : null}
    </div>
  );
}

function TimeSeriesChart({ events }: { events: Event[] }) {
  // Lightweight inline-SVG chart of (fy, topline_amount) per status.
  // We avoid Recharts here to keep the bundle lean; an upgrade is easy.
  const groups: Record<string, { fy: number; v: number }[]> = {};
  for (const e of events) {
    const key = e.status;
    (groups[key] ??= []).push({
      fy: e.fiscal_year,
      v: Number(e.topline_amount),
    });
  }
  const allPoints = Object.values(groups).flat();
  if (allPoints.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
        No events to plot.
      </p>
    );
  }

  const fys = Array.from(new Set(allPoints.map((p) => p.fy))).sort();
  const minFy = fys[0];
  const maxFy = fys[fys.length - 1];
  const minVal = 0;
  const maxVal = Math.max(...allPoints.map((p) => p.v));

  const W = 600;
  const H = 220;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xRange = Math.max(1, maxFy - minFy);
  const x = (fy: number) => padL + ((fy - minFy) / xRange) * plotW;
  const y = (v: number) =>
    padT + plotH - ((v - minVal) / Math.max(1, maxVal - minVal)) * plotH;

  const colors: Record<string, string> = {
    actual: "#10b981",
    adopted: "#0ea5e9",
    proposed: "#94a3b8",
    tentative: "#f59e0b",
    disapproved: "#ef4444",
  };

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-slate-500 dark:text-slate-500"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* y-axis grid */}
        {[0.25, 0.5, 0.75, 1].map((f, i) => {
          const yy = padT + plotH * (1 - f);
          const v = minVal + f * (maxVal - minVal);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                strokeOpacity="0.15"
                strokeDasharray="2 2"
              />
              <text
                x={padL - 6}
                y={yy + 4}
                textAnchor="end"
                fontSize="10"
                className="fill-slate-500 dark:fill-slate-400 tabular-nums"
              >
                {formatDollars(v, { forceUnit: "M", precision: 0 })}
              </text>
            </g>
          );
        })}
        {/* x-axis labels */}
        {fys.map((fy) => (
          <text
            key={fy}
            x={x(fy)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            className="fill-slate-500 dark:fill-slate-400"
          >
            FY{fy % 100}
          </text>
        ))}
        {/* lines + points per status */}
        {Object.entries(groups).map(([status, pts]) => {
          const sorted = pts.slice().sort((a, b) => a.fy - b.fy);
          const path = sorted
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.fy)} ${y(p.v)}`)
            .join(" ");
          const color = colors[status] ?? "#94a3b8";
          return (
            <g key={status}>
              <path d={path} fill="none" stroke={color} strokeWidth="2" />
              {sorted.map((p, i) => (
                <circle
                  key={i}
                  cx={x(p.fy)}
                  cy={y(p.v)}
                  r="3"
                  fill={color}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-xs mt-2">
        {Object.keys(groups).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-1.5 rounded"
              style={{ backgroundColor: colors[status] ?? "#94a3b8" }}
            />
            <span className="text-slate-600 dark:text-slate-400">{status}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
