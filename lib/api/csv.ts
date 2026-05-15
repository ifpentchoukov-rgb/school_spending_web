/**
 * CSV serializer used by /api/v1/exports/* and the public download
 * endpoints. Keys are stringified in column-order; missing keys yield
 * empty cells. Cell values get quoted only when needed.
 */

export function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: (keyof T)[],
): string {
  const header = columns.map((c) => String(c)).join(",");
  const lines = [header];
  for (const r of rows) {
    lines.push(columns.map((c) => csvCell(r[c])).join(","));
  }
  return lines.join("\n") + "\n";
}
