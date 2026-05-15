import { getServerClient } from "@/lib/supabase/server";
import {
  UNIVERSAL_CAVEATS,
  jsonError,
  jsonResponse,
} from "@/lib/api/response";
import { detectTier, tierHeaders } from "@/lib/api/tier";

export const revalidate = 300;

/**
 * Per-state coverage rollup: v_state_fy_coverage rows (one per
 * (state, fiscal_year, status) tuple) + the state's coverage_tier
 * classification from state_extractor_metadata.
 *
 * Returned as a single object wrapped in the standard `{data, _meta}`
 * envelope so clients can use the same parser as the list endpoints.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ postal: string }> },
) {
  const { postal } = await params;
  const state = postal.toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    return jsonError("invalid_state", `Invalid state postal: ${state}`);
  }
  const tier = await detectTier(request);

  const supabase = await getServerClient();
  const [coverageRes, metaRes, districtCountRes] = await Promise.all([
    supabase
      .from("v_state_fy_coverage")
      .select("*")
      .eq("state_postal", state)
      .order("fiscal_year", { ascending: false }),
    supabase
      .from("state_extractor_metadata")
      .select("*")
      .eq("state_postal", state)
      .maybeSingle(),
    supabase
      .from("districts")
      .select("leaid", { count: "exact", head: true })
      .eq("state_postal", state)
      .eq("is_operating_district", true),
  ]);

  if (coverageRes.error) {
    return jsonError("database_error", coverageRes.error.message, 500);
  }

  const summary = {
    state_postal: state,
    coverage_tier: metaRes.data?.coverage_tier ?? null,
    tier_rationale: metaRes.data?.tier_rationale ?? null,
    operating_districts_total: districtCountRes.count ?? 0,
    by_fy_status: coverageRes.data ?? [],
  };

  return jsonResponse(
    {
      data: [summary],
      _meta: {
        page: 1,
        page_size: 1,
        total: 1,
        has_next: false,
        coverage_caveats: UNIVERSAL_CAVEATS,
      },
    },
    { headers: tierHeaders(tier) },
  );
}
