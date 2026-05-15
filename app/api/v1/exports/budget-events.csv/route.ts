import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { rowsToCsv } from "@/lib/api/csv";
import { jsonError } from "@/lib/api/response";

export const revalidate = 3600;

type Event = Database["public"]["Tables"]["budget_events"]["Row"];

const COLUMNS: (keyof Event)[] = [
  "id",
  "leaid",
  "fiscal_year",
  "status",
  "topline_amount",
  "topline_definition",
  "yoy_change_pct",
  "yoy_change_dollars",
  "prior_year_baseline",
  "event_date",
  "source_document_id",
  "verification_status",
  "is_superseded",
  "created_at",
  "updated_at",
];

const HARD_CAP = 50_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fy = Number(url.searchParams.get("fiscal_year"));
  if (!fy || Number.isNaN(fy)) {
    return jsonError(
      "missing_fiscal_year",
      "fiscal_year is required (integer).",
    );
  }
  const ALLOWED_STATUS = ["proposed", "tentative", "adopted", "disapproved", "actual"] as const;
  type Status = (typeof ALLOWED_STATUS)[number];
  const rawStatus = url.searchParams.get("status");
  if (rawStatus && !ALLOWED_STATUS.includes(rawStatus as Status)) {
    return jsonError("invalid_status", `Invalid status: ${rawStatus}`);
  }
  const status = (rawStatus ?? null) as Status | null;
  const state = (url.searchParams.get("state") ?? "").toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return jsonError("invalid_state", `Invalid state postal: ${state}`);
  }

  const supabase = await getServerClient();

  // Optional state → leaid filter (resolved via districts).
  let leaids: string[] | null = null;
  if (state) {
    const { data } = await supabase
      .from("districts")
      .select("leaid")
      .eq("state_postal", state)
      .eq("is_operating_district", true);
    leaids = (data ?? []).map((d) => d.leaid);
    if (leaids.length === 0) {
      return new Response(rowsToCsv<Event>([], COLUMNS), {
        headers: csvHeaders(`empty-fy${fy}.csv`),
      });
    }
  }

  let query = supabase
    .from("budget_events")
    .select("*")
    .eq("fiscal_year", fy)
    .eq("is_superseded", false)
    .order("leaid", { ascending: true })
    .limit(HARD_CAP);
  if (status) query = query.eq("status", status);
  if (leaids) query = query.in("leaid", leaids);

  const { data, error } = await query;
  if (error) return jsonError("database_error", error.message, 500);

  const rows = (data ?? []) as Event[];
  const csv = rowsToCsv<Event>(rows, COLUMNS);

  const parts = [`budget-events`, `fy${fy}`];
  if (status) parts.push(status);
  if (state) parts.push(state.toLowerCase());
  return new Response(csv, {
    headers: csvHeaders(`${parts.join("-")}.csv`),
  });
}

function csvHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "public, max-age=600, s-maxage=3600",
  };
}
