import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import {
  UNIVERSAL_CAVEATS,
  jsonError,
  jsonResponse,
  offsetRange,
  parsePagination,
} from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { detectTier, tierHeaders } from "@/lib/api/tier";

export const revalidate = 300;

type Category = Database["public"]["Enums"]["expenditure_category"];

const VALID_CATEGORIES = new Set<Category>([
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ctx = await detectTier(request);
  const limited = await enforceRateLimit(ctx);
  if (limited) return limited;
  const { page, page_size } = parsePagination(url, ctx.tier);
  const [from, to] = offsetRange(page, page_size);

  const categoryParam = url.searchParams.get("category");
  const state = (url.searchParams.get("state") ?? "").toUpperCase();
  const fyParam = url.searchParams.get("fiscal_year");

  if (categoryParam && !VALID_CATEGORIES.has(categoryParam as Category)) {
    return jsonError(
      "invalid_category",
      `Invalid category: ${categoryParam}`,
    );
  }
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return jsonError("invalid_state", `Invalid state postal: ${state}`);
  }

  const supabase = await getServerClient();

  // Use PostgREST embed (`!inner`) to join via the FK so we don't have
  // to materialize a giant event_id IN-list in the URL. We still pull
  // state_postal via a separate districts!inner embed on budget_events.
  const select = state
    ? "*, budget_events!inner(fiscal_year, is_superseded, leaid, districts!inner(state_postal))"
    : "*, budget_events!inner(fiscal_year, is_superseded)";

  let query = supabase
    .from("budget_event_components")
    .select(select, { count: "exact" })
    .eq("budget_events.is_superseded", false)
    .order("budget_event_id", { ascending: true })
    .order("category", { ascending: true })
    .range(from, to);

  if (categoryParam) query = query.eq("category", categoryParam as Category);
  if (fyParam) query = query.eq("budget_events.fiscal_year", Number(fyParam));
  if (state) query = query.eq("budget_events.districts.state_postal", state);

  const { data, count, error } = await query;
  if (error) return jsonError("database_error", error.message, 500);

  // Strip the embedded join object — callers paid for the filter; the
  // join doesn't need to bloat the response. Keep budget_event_id as
  // the link back to /api/v1/budget-events.
  type WithJoin = Database["public"]["Tables"]["budget_event_components"]["Row"] & {
    budget_events?: unknown;
  };
  const cleaned = ((data ?? []) as WithJoin[]).map((r) => {
    const { budget_events: _be, ...rest } = r;
    return rest;
  });

  const total = count ?? 0;
  return jsonResponse(
    {
      data: cleaned,
      _meta: {
        page,
        page_size,
        total,
        has_next: from + cleaned.length < total,
        coverage_caveats: [
          ...UNIVERSAL_CAVEATS,
          "Categories the source doesn't separate are absent from this table rather than returned as zero.",
        ],
      },
    },
    { headers: tierHeaders(ctx.tier) },
  );
}

