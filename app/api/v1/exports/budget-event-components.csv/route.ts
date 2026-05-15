import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { rowsToCsv } from "@/lib/api/csv";
import { jsonError } from "@/lib/api/response";

export const revalidate = 3600;

type Component =
  Database["public"]["Tables"]["budget_event_components"]["Row"];

// Joined fields are flattened for CSV consumers.
type ComponentRow = Component & {
  leaid: string | null;
  state_postal: string | null;
  fiscal_year: number | null;
  status: string | null;
};

const COLUMNS: (keyof ComponentRow)[] = [
  "id",
  "budget_event_id",
  "leaid",
  "state_postal",
  "fiscal_year",
  "status",
  "category",
  "amount",
  "definition",
  "line_or_cell_reference",
  "created_at",
];

const HARD_CAP = 100_000;
const PAGE_SIZE = 1000;

const VALID_CATEGORIES = new Set<string>([
  "instruction",
  "support_services_student",
  "support_services_instruction",
  "administration",
  "operations_maintenance",
  "transportation",
  "food_service",
  "employee_benefits",
  "capital_outlay",
  "debt_service",
  "revenue_federal",
  "revenue_state",
  "revenue_local",
  "other",
]);

type EmbeddedRow = Component & {
  budget_events: {
    fiscal_year: number;
    status: string;
    leaid: string;
    districts: { state_postal: string } | null;
  } | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fy = Number(url.searchParams.get("fiscal_year"));
  if (!fy || Number.isNaN(fy)) {
    return jsonError(
      "missing_fiscal_year",
      "fiscal_year is required (integer).",
    );
  }
  const state = (url.searchParams.get("state") ?? "").toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return jsonError("invalid_state", `Invalid state postal: ${state}`);
  }
  const category = url.searchParams.get("category");
  if (category && !VALID_CATEGORIES.has(category)) {
    return jsonError("invalid_category", `Invalid category: ${category}`);
  }

  const supabase = await getServerClient();

  // Paginate via PostgREST range to avoid the 1000-row default cap.
  // Use the inner-join embed so the FK keeps the URL short.
  const select = state
    ? "*, budget_events!inner(fiscal_year, status, leaid, is_superseded, districts!inner(state_postal))"
    : "*, budget_events!inner(fiscal_year, status, leaid, is_superseded)";

  const all: EmbeddedRow[] = [];
  let from = 0;
  while (all.length < HARD_CAP) {
    let q = supabase
      .from("budget_event_components")
      .select(select)
      .eq("budget_events.fiscal_year", fy)
      .eq("budget_events.is_superseded", false)
      .order("budget_event_id", { ascending: true })
      .order("category", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (category) q = q.eq("category", category as Component["category"]);
    if (state) q = q.eq("budget_events.districts.state_postal", state);

    const { data, error } = await q;
    if (error) return jsonError("database_error", error.message, 500);
    const batch = (data ?? []) as unknown as EmbeddedRow[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const rows: ComponentRow[] = all.map((r) => ({
    ...(r as Component),
    leaid: r.budget_events?.leaid ?? null,
    state_postal: r.budget_events?.districts?.state_postal ?? null,
    fiscal_year: r.budget_events?.fiscal_year ?? null,
    status: r.budget_events?.status ?? null,
  }));

  const csv = rowsToCsv<ComponentRow>(rows, COLUMNS);
  const parts = [`components`, `fy${fy}`];
  if (state) parts.push(state.toLowerCase());
  if (category) parts.push(category);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${parts.join("-")}.csv"`,
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    },
  });
}
