import Link from "next/link";

import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const revalidate = 3600;

const PAGE_SIZE = 50;

function clean(q: string | undefined): string {
  if (!q) return "";
  // Strip control characters, collapse whitespace, drop SQL wildcards
  // (% _) so the user can't accidentally inflate matches.
  return q
    .normalize("NFKC")
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function loadResults(q: string, state: string, page: number) {
  if (!q) return { rows: [], total: 0 };
  const supabase = await getServerClient();
  let query = supabase
    .from("districts")
    .select(
      "leaid, lea_name, state_postal, state_leaid, county_name, enrollment_fy25, is_operating_district",
      { count: "exact" },
    )
    .eq("is_operating_district", true)
    .ilike("lea_name", `%${q}%`)
    .order("enrollment_fy25", { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (state && state !== "ALL") query = query.eq("state_postal", state);
  const { data, count } = await query;
  return { rows: data ?? [], total: count ?? 0 };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = clean(typeof params.q === "string" ? params.q : "");
  const state =
    typeof params.state === "string" && params.state.length === 2
      ? params.state.toUpperCase()
      : "ALL";
  const page =
    typeof params.page === "string" ? Math.max(1, Number(params.page)) : 1;

  const { rows, total } = q
    ? await loadResults(q, state, page)
    : { rows: [], total: 0 };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Find a district
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Search ~11,800 U.S. K-12 operating school districts by name.
        </p>
      </header>

      <form
        className="flex flex-col sm:flex-row gap-2 mb-6"
        action="/search"
        method="get"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Albany, Houston ISD, Boise…"
          className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-base"
          autoFocus
          aria-label="District name search"
        />
        <select
          name="state"
          defaultValue={state}
          className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-base"
          aria-label="Filter by state"
        >
          <option value="ALL">All states</option>
          {[
            "AL","AZ","AR","CA","CO","CT","DC","FL","GA","HI","ID","IL",
            "IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO",
            "MT","NE","NH","NJ","NY","NC","ND","OH","OK","OR","PA","SC",
            "SD","TN","TX","UT","VT","VA","WA","WV","WI",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-sky-600 hover:bg-sky-700 text-white text-sm px-4 py-2"
        >
          Search
        </button>
      </form>

      {q === "" ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
          Type a district name above to begin.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
          No districts match{" "}
          <span className="font-mono">&ldquo;{q}&rdquo;</span>
          {state !== "ALL" ? <> in {state}</> : null}. Try a different spelling
          or broaden the state filter.
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {formatNumber(total)} match{total === 1 ? "" : "es"}
            {state !== "ALL" ? <> in {state}</> : null} for{" "}
            <span className="font-mono">&ldquo;{q}&rdquo;</span>. Largest first.
          </p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
            {rows.map((d) => (
              <li
                key={d.leaid}
                className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/40"
              >
                <Link
                  href={`/states/${d.state_postal}/${d.leaid}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-slate-800 dark:text-slate-200 truncate">
                      {d.lea_name}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {d.state_postal}
                      {d.county_name ? ` · ${d.county_name} County` : ""}
                      {" · "}
                      <span className="font-mono">{d.leaid}</span>
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                    {d.enrollment_fy25
                      ? `${formatNumber(d.enrollment_fy25)} students`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav
              className="mt-4 flex items-center justify-between text-sm"
              aria-label="Pagination"
            >
              <span className="text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={`/search?${new URLSearchParams({ q, state, page: String(page - 1) }).toString()}`}
                    className="rounded border border-slate-200 dark:border-slate-700 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    ← Prev
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={`/search?${new URLSearchParams({ q, state, page: String(page + 1) }).toString()}`}
                    className="rounded border border-slate-200 dark:border-slate-700 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
