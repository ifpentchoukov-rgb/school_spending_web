import Link from "next/link";

import { GRID_COLS, GRID_ROWS, STATE_GRID } from "@/lib/state-grid";
import { getServerClient } from "@/lib/supabase/server";
import { formatDollars } from "@/lib/utils";

export const revalidate = 3600;

type CoverageRow = {
  state_postal: string | null;
  fiscal_year: number | null;
  status: string | null;
  total_amount: number | null;
};

async function loadCoverage() {
  const supabase = await getServerClient();
  const { data: coverage } = await supabase
    .from("v_state_fy_coverage")
    .select("state_postal, fiscal_year, status, total_amount")
    .returns<CoverageRow[]>();

  const byState = new Map<
    string,
    {
      latestActualFy: number;
      latestAdoptedFy: number;
      total: number;
    }
  >();
  for (const row of coverage ?? []) {
    if (!row.state_postal) continue;
    const cur = byState.get(row.state_postal) ?? {
      latestActualFy: 0,
      latestAdoptedFy: 0,
      total: 0,
    };
    if (row.status === "actual") {
      cur.latestActualFy = Math.max(cur.latestActualFy, row.fiscal_year ?? 0);
    } else if (row.status === "adopted") {
      cur.latestAdoptedFy = Math.max(cur.latestAdoptedFy, row.fiscal_year ?? 0);
    }
    cur.total += Number(row.total_amount ?? 0);
    byState.set(row.state_postal, cur);
  }
  return byState;
}

type StateStatus = "live-both" | "live-actual" | "live-adopted" | "deferred";

function classifyState(
  info: { latestActualFy: number; latestAdoptedFy: number } | undefined,
): StateStatus {
  if (!info) return "deferred";
  if (info.latestActualFy && info.latestAdoptedFy) return "live-both";
  if (info.latestAdoptedFy) return "live-adopted";
  if (info.latestActualFy) return "live-actual";
  return "deferred";
}

const STATUS_STYLE: Record<StateStatus, { bg: string; label: string }> = {
  "live-both": {
    bg: "fill-emerald-500 hover:fill-emerald-600",
    label: "Actual + Adopted",
  },
  "live-actual": {
    bg: "fill-sky-500 hover:fill-sky-600",
    label: "Actual only",
  },
  "live-adopted": {
    bg: "fill-amber-400 hover:fill-amber-500",
    label: "Adopted only",
  },
  deferred: {
    bg: "fill-slate-300 dark:fill-slate-700 hover:fill-slate-400 dark:hover:fill-slate-600",
    label: "Deferred",
  },
};

export default async function CoverageMapPage() {
  const byState = await loadCoverage();

  const counts = { "live-both": 0, "live-actual": 0, "live-adopted": 0, deferred: 0 };
  for (const cell of STATE_GRID) {
    const cls = classifyState(byState.get(cell.postal));
    counts[cls]++;
  }

  const cellSize = 64;
  const gap = 4;
  const W = GRID_COLS * (cellSize + gap);
  const H = GRID_ROWS * (cellSize + gap);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Coverage Map
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Squarified U.S. state grid showing pipeline coverage at a glance.
          Hover any state for the latest FY we have, or click through for full
          per-LEA detail.
        </p>
      </header>

      <section className="mb-6 flex flex-wrap items-center gap-4 text-xs">
        <Legend
          color="bg-emerald-500"
          label={`Both actual + adopted (${counts["live-both"]})`}
        />
        <Legend
          color="bg-sky-500"
          label={`Actual only (${counts["live-actual"]})`}
        />
        <Legend
          color="bg-amber-400"
          label={`Adopted only (${counts["live-adopted"]})`}
        />
        <Legend
          color="bg-slate-300 dark:bg-slate-700"
          label={`Deferred (${counts.deferred})`}
        />
      </section>

      <section className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-[800px] mx-auto block"
          preserveAspectRatio="xMidYMid meet"
        >
          {STATE_GRID.map((cell) => {
            const info = byState.get(cell.postal);
            const status = classifyState(info);
            const x = cell.col * (cellSize + gap);
            const y = cell.row * (cellSize + gap);
            const fyLabel = info
              ? info.latestAdoptedFy
                ? `FY${info.latestAdoptedFy % 100} adopted`
                : info.latestActualFy
                  ? `FY${info.latestActualFy % 100} actual`
                  : ""
              : "deferred";
            const tooltip = `${cell.postal}: ${STATUS_STYLE[status].label}${
              info ? " · " + formatDollars(info.total, { forceUnit: "B" }) : ""
            }`;
            return (
              <a
                key={cell.postal}
                href={`/states/${cell.postal}`}
                className="cursor-pointer"
              >
                <title>{tooltip}</title>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={6}
                  className={`${STATUS_STYLE[status].bg} transition-colors`}
                />
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize / 2 - 4}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="bold"
                  className={
                    status === "deferred"
                      ? "fill-slate-700 dark:fill-slate-300"
                      : "fill-white"
                  }
                >
                  {cell.postal}
                </text>
                {fyLabel ? (
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2 + 14}
                    textAnchor="middle"
                    fontSize="9"
                    className={
                      status === "deferred"
                        ? "fill-slate-500 dark:fill-slate-500"
                        : "fill-white/90"
                    }
                  >
                    {fyLabel}
                  </text>
                ) : null}
              </a>
            );
          })}
        </svg>
      </section>

      <section className="mt-10 text-sm text-slate-600 dark:text-slate-400">
        <p>
          The coverage map updates within a few seconds of any extractor run.
          Click any state for per-LEA detail, source documents, and
          methodology.{" "}
          <Link
            href="/states"
            className="text-sky-600 hover:underline dark:text-sky-400"
          >
            See the full sortable index →
          </Link>
        </p>
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded ${color}`} />
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
    </span>
  );
}
