import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { rowsToCsv } from "@/lib/api/csv";
import { jsonError } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { detectTier } from "@/lib/api/tier";

export const revalidate = 86400;

type District = Database["public"]["Tables"]["districts"]["Row"];

const COLUMNS: (keyof District)[] = [
  "leaid",
  "lea_name",
  "state_postal",
  "state_leaid",
  "county_name",
  "enrollment_fy25",
  "entity_type",
  "fy_calendar",
  "is_operating_district",
];

export async function GET(request: Request) {
  const ctx = await detectTier(request);
  const limited = await enforceRateLimit(ctx);
  if (limited) return limited;
  const supabase = await getServerClient();

  // Paginate through the table — Supabase caps SELECT at ~1000 by default.
  const chunkSize = 1000;
  const all: District[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .eq("is_operating_district", true)
      .order("leaid", { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error) return jsonError("database_error", error.message, 500);
    const batch = (data ?? []) as District[];
    all.push(...batch);
    if (batch.length < chunkSize) break;
    from += chunkSize;
  }

  const csv = rowsToCsv<District>(all, COLUMNS);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="districts.csv"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
