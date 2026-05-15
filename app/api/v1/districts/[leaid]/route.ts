import { getServerClient } from "@/lib/supabase/server";
import {
  UNIVERSAL_CAVEATS,
  jsonError,
  jsonResponse,
} from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { detectTier, tierHeaders } from "@/lib/api/tier";

export const revalidate = 300;

/**
 * Single-district detail: district row + every non-superseded budget
 * event with its source document + components. Returned as a wrapped
 * `{ data: [single_obj], _meta: {...} }` so the schema matches the
 * list endpoint and callers can use one parser.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  if (!/^[0-9A-Z]{1,12}$/i.test(leaid)) {
    return jsonError("invalid_leaid", `Invalid leaid: ${leaid}`);
  }
  const ctx = await detectTier(request);
  const limited = await enforceRateLimit(ctx);
  if (limited) return limited;

  const supabase = await getServerClient();

  const [districtRes, eventsRes] = await Promise.all([
    supabase
      .from("districts")
      .select("*")
      .eq("leaid", leaid)
      .maybeSingle(),
    supabase
      .from("budget_events")
      .select("*")
      .eq("leaid", leaid)
      .eq("is_superseded", false)
      .order("fiscal_year", { ascending: false }),
  ]);

  if (districtRes.error) {
    return jsonError("database_error", districtRes.error.message, 500);
  }
  if (!districtRes.data) {
    return jsonError("not_found", `No district with leaid ${leaid}`, 404);
  }

  const events = eventsRes.data ?? [];
  const eventIds = events.map((e) => e.id);

  const [componentsRes, sourcesRes] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from("budget_event_components")
          .select("*")
          .in("budget_event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    events.length > 0
      ? supabase
          .from("source_documents")
          .select("*")
          .in(
            "id",
            events
              .map((e) => e.source_document_id)
              .filter((id): id is string => !!id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const components = componentsRes.data ?? [];
  const sources = sourcesRes.data ?? [];

  const componentsByEvent = new Map<string, typeof components>();
  for (const c of components) {
    const list = componentsByEvent.get(c.budget_event_id) ?? [];
    list.push(c);
    componentsByEvent.set(c.budget_event_id, list);
  }
  const sourcesById = new Map(sources.map((s) => [s.id, s]));

  const expanded = events.map((e) => ({
    ...e,
    source_document: sourcesById.get(e.source_document_id) ?? null,
    components: componentsByEvent.get(e.id) ?? [],
  }));

  const district = {
    ...districtRes.data,
    events: expanded,
  };

  return jsonResponse(
    {
      data: [district],
      _meta: {
        page: 1,
        page_size: 1,
        total: 1,
        has_next: false,
        coverage_caveats: UNIVERSAL_CAVEATS,
      },
    },
    { headers: tierHeaders(ctx.tier) },
  );
}
