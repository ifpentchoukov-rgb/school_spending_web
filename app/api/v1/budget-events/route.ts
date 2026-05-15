import { getServerClient } from "@/lib/supabase/server";
import {
  UNIVERSAL_CAVEATS,
  jsonError,
  jsonResponse,
  offsetRange,
  parsePagination,
} from "@/lib/api/response";
import { detectTier, tierHeaders } from "@/lib/api/tier";

export const revalidate = 300;

const ALLOWED_STATUS = [
  "proposed",
  "tentative",
  "adopted",
  "disapproved",
  "actual",
] as const;
type Status = (typeof ALLOWED_STATUS)[number];

const ALLOWED_VERIFICATION = [
  "unverified",
  "verified",
  "flagged",
  "disputed",
] as const;
type Verification = (typeof ALLOWED_VERIFICATION)[number];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tier = await detectTier(request);
  const { page, page_size } = parsePagination(url, tier);
  const [from, to] = offsetRange(page, page_size);

  const state = (url.searchParams.get("state") ?? "").toUpperCase();
  const leaid = url.searchParams.get("leaid");
  const fyParam = url.searchParams.get("fiscal_year");
  const statusParam = url.searchParams.get("status");
  const verificationParam = url.searchParams.get("verification_status");
  const includeSuperseded = url.searchParams.get("include_superseded") === "true";

  if (state && !/^[A-Z]{2}$/.test(state)) {
    return jsonError("invalid_state", `Invalid state postal: ${state}`);
  }
  if (statusParam && !ALLOWED_STATUS.includes(statusParam as Status)) {
    return jsonError("invalid_status", `Invalid status: ${statusParam}`);
  }
  if (
    verificationParam &&
    !ALLOWED_VERIFICATION.includes(verificationParam as Verification)
  ) {
    return jsonError(
      "invalid_verification",
      `Invalid verification_status: ${verificationParam}`,
    );
  }

  const supabase = await getServerClient();

  // State filter requires a leaid join; do it via a districts pre-query
  // to keep this endpoint's main query simple and indexable.
  let leaidFilter: string[] | null = null;
  if (state) {
    const { data: stateDistricts } = await supabase
      .from("districts")
      .select("leaid")
      .eq("state_postal", state)
      .eq("is_operating_district", true);
    leaidFilter = (stateDistricts ?? []).map((d) => d.leaid);
    if (leaidFilter.length === 0) {
      return jsonResponse(
        {
          data: [],
          _meta: {
            page,
            page_size,
            total: 0,
            has_next: false,
            coverage_caveats: UNIVERSAL_CAVEATS,
          },
        },
        { headers: tierHeaders(tier) },
      );
    }
  }

  let query = supabase
    .from("budget_events")
    .select("*", { count: "exact" })
    .order("fiscal_year", { ascending: false })
    .order("leaid", { ascending: true })
    .range(from, to);

  if (!includeSuperseded) query = query.eq("is_superseded", false);
  if (leaid) query = query.eq("leaid", leaid);
  if (leaidFilter) query = query.in("leaid", leaidFilter);
  if (fyParam) query = query.eq("fiscal_year", Number(fyParam));
  if (statusParam) query = query.eq("status", statusParam as Status);
  if (verificationParam)
    query = query.eq("verification_status", verificationParam as Verification);

  const { data, count, error } = await query;
  if (error) return jsonError("database_error", error.message, 500);

  const total = count ?? 0;
  return jsonResponse(
    {
      data: data ?? [],
      _meta: {
        page,
        page_size,
        total,
        has_next: from + (data?.length ?? 0) < total,
        coverage_caveats: UNIVERSAL_CAVEATS,
      },
    },
    { headers: tierHeaders(tier) },
  );
}
