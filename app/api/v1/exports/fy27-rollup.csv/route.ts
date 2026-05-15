import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { rowsToCsv } from "@/lib/api/csv";
import { jsonError } from "@/lib/api/response";

export const revalidate = 3600;

type RollupRow = Database["public"]["Views"]["v_fy27_rollup"]["Row"];

const COLUMNS: (keyof RollupRow)[] = [
  "leaid",
  "lea_name",
  "state_postal",
  "state_leaid",
  "county_name",
  "enrollment_fy25",
  "entity_type",
  "fy27_amount",
  "fy27_per_pupil",
  "fy27_definition",
  "fy26_baseline_status",
  "fy26_baseline_amount",
  "fy26_per_pupil",
  "fy26_baseline_definition",
  "dollar_change",
  "pct_change",
  "change_bucket",
  "fy27_event_id",
  "fy26_event_id",
  "fy27_source_document_id",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = (url.searchParams.get("state") ?? "").toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return jsonError("invalid_state", `Invalid state postal: ${state}`);
  }

  const supabase = await getServerClient();
  let q = supabase
    .from("v_fy27_rollup")
    .select("*")
    .order("state_postal", { ascending: true })
    .order("fy27_amount", { ascending: false, nullsFirst: false })
    .limit(15000);
  if (state) q = q.eq("state_postal", state);

  const { data, error } = await q;
  if (error) return jsonError("database_error", error.message, 500);

  const rows = (data ?? []) as RollupRow[];
  const csv = rowsToCsv<RollupRow>(rows, COLUMNS);

  const filename = state ? `fy27-rollup-${state.toLowerCase()}.csv` : "fy27-rollup.csv";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    },
  });
}
