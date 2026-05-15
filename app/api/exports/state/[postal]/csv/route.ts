import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

export const revalidate = 3600;

type PerPupilRow =
  Database["public"]["Views"]["v_per_pupil_metrics"]["Row"];

const COLUMNS: (keyof PerPupilRow)[] = [
  "leaid",
  "lea_name",
  "state_postal",
  "state_leaid",
  "county_name",
  "enrollment_fy25",
  "fiscal_year",
  "status",
  "topline_amount",
  "topline_per_pupil",
  "yoy_change_pct",
  "instruction_amount",
  "instruction_per_pupil",
  "support_services_student_amount",
  "support_services_student_per_pupil",
  "support_services_instruction_amount",
  "support_services_instruction_per_pupil",
  "administration_amount",
  "administration_per_pupil",
  "operations_maintenance_amount",
  "operations_maintenance_per_pupil",
  "transportation_amount",
  "transportation_per_pupil",
  "food_service_amount",
  "food_service_per_pupil",
  "employee_benefits_amount",
  "employee_benefits_per_pupil",
  "capital_outlay_amount",
  "capital_outlay_per_pupil",
  "debt_service_amount",
  "debt_service_per_pupil",
  "other_amount",
  "other_per_pupil",
  "revenue_federal_amount",
  "revenue_federal_per_pupil",
  "revenue_state_amount",
  "revenue_state_per_pupil",
  "revenue_local_amount",
  "revenue_local_per_pupil",
];

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postal: string }> },
) {
  const { postal } = await params;
  const state = postal.toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    return new Response("Invalid state postal\n", { status: 400 });
  }

  const url = new URL(request.url);
  const ALLOWED_STATUS = ["proposed", "tentative", "adopted", "disapproved", "actual"] as const;
  type Status = (typeof ALLOWED_STATUS)[number];
  const rawStatus = url.searchParams.get("status") ?? "actual";
  if (!ALLOWED_STATUS.includes(rawStatus as Status)) {
    return new Response(`Invalid status: ${rawStatus}\n`, { status: 400 });
  }
  const status = rawStatus as Status;
  const fyParam = url.searchParams.get("fy");

  const supabase = await getServerClient();

  let fy = fyParam ? Number(fyParam) : NaN;
  if (!fy || Number.isNaN(fy)) {
    const { data: latest } = await supabase
      .from("v_per_pupil_metrics")
      .select("fiscal_year")
      .eq("state_postal", state)
      .eq("status", status)
      .order("fiscal_year", { ascending: false })
      .limit(1);
    fy = latest?.[0]?.fiscal_year ?? 2024;
  }

  const { data } = await supabase
    .from("v_per_pupil_metrics")
    .select("*")
    .eq("state_postal", state)
    .eq("status", status)
    .eq("fiscal_year", fy)
    .eq("is_operating_district", true)
    .order("topline_amount", { ascending: false });

  const rows = (data ?? []) as PerPupilRow[];

  const header = COLUMNS.join(",");
  const lines = [header];
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => csvCell(r[c])).join(","));
  }
  const csv = lines.join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${state}-fy${fy}-${status}.csv"`,
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
