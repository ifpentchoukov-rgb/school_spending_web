import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { detectTier } from "@/lib/api/tier";

export const revalidate = 3600;

type PerPupilRow =
  Database["public"]["Views"]["v_per_pupil_metrics"]["Row"];

// Mirror /rankings page metric columns.
const ALLOWED_METRICS = new Set<string>([
  "topline_per_pupil",
  "instruction_per_pupil",
  "administration_per_pupil",
  "debt_service_per_pupil",
  "capital_outlay_per_pupil",
  "employee_benefits_per_pupil",
  "food_service_per_pupil",
  "yoy_change_pct",
]);

const COLUMNS: (keyof PerPupilRow)[] = [
  "leaid",
  "lea_name",
  "state_postal",
  "enrollment_fy25",
  "fiscal_year",
  "status",
  "topline_amount",
  "topline_per_pupil",
];

const BANDS: Record<string, { min: number; max: number }> = {
  all: { min: 0, max: Number.POSITIVE_INFINITY },
  mega: { min: 50000, max: Number.POSITIVE_INFINITY },
  large: { min: 10000, max: 50000 },
  mid: { min: 2000, max: 10000 },
  small: { min: 0, max: 2000 },
};

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const ctx = await detectTier(request);
  const limited = await enforceRateLimit(ctx);
  if (limited) return limited;
  const url = new URL(request.url);
  const metric = url.searchParams.get("metric") ?? "topline_per_pupil";
  if (!ALLOWED_METRICS.has(metric)) {
    return new Response(`Invalid metric: ${metric}\n`, { status: 400 });
  }
  const state =
    (url.searchParams.get("state") ?? "ALL").toUpperCase();
  const bandId = url.searchParams.get("band") ?? "all";
  const band = BANDS[bandId] ?? BANDS.all;
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const fyParam = url.searchParams.get("fy");

  const supabase = await getServerClient();

  let fy = fyParam ? Number(fyParam) : NaN;
  if (!fy || Number.isNaN(fy)) {
    const latestQ = supabase
      .from("v_per_pupil_metrics")
      .select("fiscal_year")
      .eq("status", "actual")
      .order("fiscal_year", { ascending: false })
      .limit(1);
    const { data } =
      state !== "ALL" ? await latestQ.eq("state_postal", state) : await latestQ;
    fy = data?.[0]?.fiscal_year ?? 2024;
  }

  let query = supabase
    .from("v_per_pupil_metrics")
    .select("*")
    .eq("status", "actual")
    .eq("fiscal_year", fy)
    .eq("is_operating_district", true)
    .not(metric, "is", null)
    .order(metric, { ascending: order === "asc", nullsFirst: false })
    .limit(5000); // hard cap; tighten later
  if (state !== "ALL") query = query.eq("state_postal", state);
  if (band.min > 0) query = query.gte("enrollment_fy25", band.min);
  if (band.max !== Number.POSITIVE_INFINITY)
    query = query.lt("enrollment_fy25", band.max);

  const { data } = await query;
  const rows = (data ?? []) as PerPupilRow[];

  // Include the ranking metric as a column even if it's not in COLUMNS.
  const allCols: (keyof PerPupilRow)[] = COLUMNS.includes(
    metric as keyof PerPupilRow,
  )
    ? COLUMNS
    : ([...COLUMNS, metric as keyof PerPupilRow] as (keyof PerPupilRow)[]);

  const header = ["rank", ...allCols.map(String)].join(",");
  const lines = [header];
  rows.forEach((r, i) => {
    const cells = [
      String(i + 1),
      ...allCols.map((c) => csvCell(r[c])),
    ];
    lines.push(cells.join(","));
  });
  const csv = lines.join("\n") + "\n";

  const parts = ["rankings", state.toLowerCase(), bandId, `fy${fy}`, metric, order];
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${parts.join("-")}.csv"`,
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
