import { getServerClient } from "@/lib/supabase/server";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ctx = await detectTier(request);
  const limited = await enforceRateLimit(ctx);
  if (limited) return limited;
  const { page, page_size } = parsePagination(url, ctx.tier);
  const [from, to] = offsetRange(page, page_size);

  const state = (url.searchParams.get("state") ?? "").toUpperCase();
  const entityType = url.searchParams.get("entity_type");
  const minEnroll = Number(url.searchParams.get("min_enrollment")) || null;
  const maxEnroll = Number(url.searchParams.get("max_enrollment")) || null;

  if (state && !/^[A-Z]{2}$/.test(state)) {
    return jsonError("invalid_state", `Invalid state postal: ${state}`);
  }

  const supabase = await getServerClient();
  let query = supabase
    .from("districts")
    .select("*", { count: "exact" })
    .eq("is_operating_district", true)
    .order("enrollment_fy25", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (state) query = query.eq("state_postal", state);
  if (entityType) query = query.eq("entity_type", entityType);
  if (minEnroll != null) query = query.gte("enrollment_fy25", minEnroll);
  if (maxEnroll != null) query = query.lte("enrollment_fy25", maxEnroll);

  const { data, count, error } = await query;
  if (error) {
    return jsonError("database_error", error.message, 500);
  }

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
    { headers: tierHeaders(ctx.tier) },
  );
}
