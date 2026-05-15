import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

export type PerPupilRow =
  Database["public"]["Views"]["v_per_pupil_metrics"]["Row"];

export const MAX_LEAS = 4;

// Per-pupil columns surfaced in the comparison + CSV. Order is the
// display order.
export const COMPARE_ROWS: {
  key: keyof PerPupilRow;
  label: string;
  group: "exp" | "rev";
  emphasis?: boolean;
}[] = [
  { key: "topline_per_pupil", label: "Total operating", group: "exp", emphasis: true },
  { key: "instruction_per_pupil", label: "Instruction", group: "exp" },
  { key: "support_services_student_per_pupil", label: "Student support", group: "exp" },
  { key: "support_services_instruction_per_pupil", label: "Instructional support", group: "exp" },
  { key: "administration_per_pupil", label: "Administration", group: "exp" },
  { key: "operations_maintenance_per_pupil", label: "Operations & maintenance", group: "exp" },
  { key: "transportation_per_pupil", label: "Transportation", group: "exp" },
  { key: "food_service_per_pupil", label: "Food service", group: "exp" },
  { key: "employee_benefits_per_pupil", label: "Employee benefits", group: "exp" },
  { key: "capital_outlay_per_pupil", label: "Capital outlay", group: "exp" },
  { key: "debt_service_per_pupil", label: "Debt service", group: "exp" },
  { key: "other_per_pupil", label: "Other", group: "exp" },
  { key: "revenue_federal_per_pupil", label: "Federal revenue", group: "rev" },
  { key: "revenue_state_per_pupil", label: "State revenue", group: "rev" },
  { key: "revenue_local_per_pupil", label: "Local revenue", group: "rev" },
];

export function parseLeaIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9A-Z]{1,12}$/i.test(s))
    .slice(0, MAX_LEAS);
}

export async function loadLatestForCompare(
  leaids: string[],
): Promise<PerPupilRow[]> {
  if (leaids.length === 0) return [];
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("v_per_pupil_metrics")
    .select("*")
    .in("leaid", leaids)
    .eq("status", "actual")
    .order("fiscal_year", { ascending: false });
  const latestByLea = new Map<string, PerPupilRow>();
  for (const r of data ?? []) {
    if (!r.leaid) continue;
    if (!latestByLea.has(r.leaid)) latestByLea.set(r.leaid, r);
  }
  return leaids
    .map((id) => latestByLea.get(id))
    .filter((r): r is PerPupilRow => r != null);
}

export function getCompareValue(
  row: PerPupilRow,
  key: keyof PerPupilRow,
): number | null {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function toCsv(rows: PerPupilRow[]): string {
  const header = [
    "category_label",
    ...rows.map(
      (r) => `${r.state_postal ?? ""} ${r.lea_name ?? r.leaid ?? ""}`,
    ),
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const meta of COMPARE_ROWS) {
    const cells: string[] = [meta.label];
    for (const r of rows) {
      const v = getCompareValue(r, meta.key);
      cells.push(v == null ? "" : Math.round(v).toString());
    }
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
