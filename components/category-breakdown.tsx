import type { Database } from "@/lib/types";
import { formatDollars, formatNumber } from "@/lib/utils";

type Category = Database["public"]["Enums"]["expenditure_category"];
type Component = Database["public"]["Tables"]["budget_event_components"]["Row"];
type Event = Database["public"]["Tables"]["budget_events"]["Row"];

const EXPENDITURE_ORDER: { key: Category; label: string; tone?: "muted" }[] = [
  { key: "instruction", label: "Instruction" },
  { key: "support_services_student", label: "Student support" },
  { key: "support_services_instruction", label: "Instructional support" },
  { key: "administration", label: "Administration" },
  { key: "operations_maintenance", label: "Operations & maintenance" },
  { key: "transportation", label: "Transportation" },
  { key: "food_service", label: "Food service" },
  { key: "employee_benefits", label: "Employee benefits" },
  { key: "capital_outlay", label: "Capital outlay", tone: "muted" },
  { key: "debt_service", label: "Debt service", tone: "muted" },
  { key: "other", label: "Other", tone: "muted" },
];

const REVENUE_ORDER: { key: Category; label: string }[] = [
  { key: "revenue_federal", label: "Federal revenue" },
  { key: "revenue_state", label: "State revenue" },
  { key: "revenue_local", label: "Local revenue" },
];

type Props = {
  /** Non-superseded budget events ordered however; we'll sort/group inside. */
  events: Event[];
  /** Components for those events (joined by budget_event_id). */
  components: Component[];
  /** Enrollment denominator for the per-pupil column. NULL/0 → hide PP. */
  enrollment: number | null;
};

/**
 * Wide-format category breakdown: rows = canonical expenditure_category
 * values, cols = recent actual-status FYs. Cells show dollars (forceUnit:
 * "M" when ≥$1M else $K). A rightmost "per pupil" column shows the
 * latest-FY per-pupil amount.
 *
 * Categories the source doesn't separate (NULL via LEFT JOIN against the
 * components table) render as a faded em-dash so the user sees the
 * coverage gap rather than a deceptive 0.
 */
export function CategoryBreakdown({ events, components, enrollment }: Props) {
  // Filter to actuals; we want comparable apples-to-apples FYs.
  const actuals = events
    .filter((e) => e.status === "actual" && !e.is_superseded)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, 4); // up to 4 most-recent FYs

  if (actuals.length === 0) {
    return null;
  }

  // Build {category: {fy: amount}}
  const byCategory = new Map<Category, Map<number, number>>();
  const eventIdToFy = new Map(actuals.map((e) => [e.id, e.fiscal_year]));
  for (const c of components) {
    const fy = eventIdToFy.get(c.budget_event_id);
    if (fy == null) continue;
    const inner = byCategory.get(c.category) ?? new Map<number, number>();
    inner.set(fy, Number(c.amount));
    byCategory.set(c.category, inner);
  }

  const latestFy = actuals[0]?.fiscal_year ?? null;
  const renderRow = (
    cat: { key: Category; label: string; tone?: "muted" },
  ) => {
    const cells = byCategory.get(cat.key);
    if (!cells || cells.size === 0) return null;
    const latestAmount = latestFy != null ? cells.get(latestFy) : undefined;
    const perPupil =
      latestAmount != null && enrollment && enrollment > 0
        ? latestAmount / enrollment
        : null;
    const labelCls =
      cat.tone === "muted"
        ? "text-slate-500 dark:text-slate-400"
        : "text-slate-700 dark:text-slate-200";
    return (
      <tr
        key={cat.key}
        className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
      >
        <th
          scope="row"
          className={`px-4 py-2 text-left text-sm font-normal ${labelCls}`}
        >
          {cat.label}
        </th>
        {actuals.map((e) => {
          const v = cells.get(e.fiscal_year);
          return (
            <td
              key={e.id}
              className="px-4 py-2 text-right tabular-nums text-sm text-slate-700 dark:text-slate-300"
            >
              {v != null ? (
                formatDollars(v, { forceUnit: "M" })
              ) : (
                <span className="text-slate-300 dark:text-slate-700">—</span>
              )}
            </td>
          );
        })}
        <td className="px-4 py-2 text-right tabular-nums text-sm text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800">
          {perPupil != null ? (
            `$${formatNumber(Math.round(perPupil))}`
          ) : (
            <span className="text-slate-300 dark:text-slate-700">—</span>
          )}
        </td>
      </tr>
    );
  };

  const expRows = EXPENDITURE_ORDER.map(renderRow).filter(Boolean);
  const revRows = REVENUE_ORDER.map(renderRow).filter(Boolean);

  if (expRows.length === 0 && revRows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
        No category breakdown available for this LEA. The source publishes
        a topline only — see the topline definition below.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Category</th>
            {actuals.map((e) => (
              <th
                key={e.id}
                className="text-right px-4 py-2 font-medium tabular-nums"
              >
                FY{e.fiscal_year % 100}
              </th>
            ))}
            <th className="text-right px-4 py-2 font-medium border-l border-slate-200 dark:border-slate-800">
              Per pupil
              {latestFy != null ? (
                <span className="block text-[10px] font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                  FY{latestFy % 100}
                </span>
              ) : null}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {expRows}
          {revRows.length > 0 ? (
            <>
              <tr className="bg-slate-100/60 dark:bg-slate-900/60">
                <th
                  colSpan={actuals.length + 2}
                  className="px-4 py-1.5 text-left text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium"
                >
                  Revenue (where source separates)
                </th>
              </tr>
              {revRows}
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
