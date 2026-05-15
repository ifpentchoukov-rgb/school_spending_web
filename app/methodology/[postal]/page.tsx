import Link from "next/link";
import { notFound } from "next/navigation";

import extractorDocs from "@/lib/extractor-docs.json";
import { getStateMeta, getStateName } from "@/lib/state-meta";
import { getServerClient } from "@/lib/supabase/server";
import { formatDollars, formatNumber } from "@/lib/utils";

export const revalidate = 86400;

type ExtractorDoc = {
  module: string;
  sourceFile: string;
  state: string | null;
  bucket: string | null;
  extractorName: string | null;
  publisher: string | null;
  documentType: string | null;
  sourcePortalUrl: string | null;
  toplineDefinition: string | null;
  docstring: string;
  summary: string;
};

const docs = extractorDocs as Record<string, ExtractorDoc>;

async function loadState(postal: string) {
  const supabase = await getServerClient();

  const [{ data: tier }, { data: coverage }, { count: districtCount }] =
    await Promise.all([
      supabase
        .from("state_extractor_metadata")
        .select("*")
        .eq("state_postal", postal)
        .maybeSingle(),
      supabase
        .from("v_state_fy_coverage")
        .select("*")
        .eq("state_postal", postal)
        .order("fiscal_year", { ascending: false }),
      supabase
        .from("districts")
        .select("leaid", { count: "exact", head: true })
        .eq("state_postal", postal)
        .eq("is_operating_district", true),
    ]);

  // latest source document update for this state's events
  const stateExtractors = Object.values(docs).filter(
    (d) => d.state === postal,
  );

  return {
    tier,
    coverage: coverage ?? [],
    districtCount: districtCount ?? 0,
    extractors: stateExtractors,
  };
}

export default async function StateMethodologyPage({
  params,
}: {
  params: Promise<{ postal: string }>;
}) {
  const { postal: rawPostal } = await params;
  const postal = rawPostal.toUpperCase();
  const meta = getStateMeta(postal);
  if (!meta) notFound();

  const data = await loadState(postal);
  if (data.extractors.length === 0 && data.districtCount === 0) {
    notFound();
  }

  const stateName = getStateName(postal);
  const latestActual = data.coverage.find((c) => c.status === "actual");
  const latestAdopted = data.coverage.find((c) => c.status === "adopted");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <Link
          href="/methodology"
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          ← All methodology
        </Link>
        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {stateName} methodology
          </h1>
          {data.tier ? (
            <TierBadge
              tier={data.tier.coverage_tier}
              rationale={data.tier.tier_rationale}
            />
          ) : null}
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          How {postal} budget data is captured, what each topline includes, and
          what the {data.tier?.coverage_tier ?? "—"} coverage tier means for
          cross-state comparison.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Operating districts"
          value={formatNumber(data.districtCount)}
        />
        <Stat
          label="Latest actuals"
          value={
            latestActual
              ? `FY${(latestActual.fiscal_year ?? 0) % 100} · ${formatNumber(latestActual.n_leas)} LEAs · ${formatDollars(latestActual.total_amount, { forceUnit: "B" })}`
              : "—"
          }
        />
        <Stat
          label="Latest adopted"
          value={
            latestAdopted
              ? `FY${(latestAdopted.fiscal_year ?? 0) % 100} · ${formatNumber(latestAdopted.n_leas)} LEAs · ${formatDollars(latestAdopted.total_amount, { forceUnit: "B" })}`
              : "no adopted-budget pipeline"
          }
        />
      </section>

      {data.tier?.tier_rationale ? (
        <section className="mb-8 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Coverage tier rationale
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {data.tier.tier_rationale}
          </p>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Source extractors ({data.extractors.length})
        </h2>
        <div className="space-y-5">
          {data.extractors.map((doc) => (
            <ExtractorCard key={doc.module} doc={doc} />
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Coverage by fiscal year
        </h2>
        {data.coverage.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No budget events tracked for {postal} yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left py-2 font-medium">FY</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-right py-2 font-medium">LEAs</th>
                <th className="text-right py-2 font-medium">Verified</th>
                <th className="text-right py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.coverage.map((c) => (
                <tr key={`${c.fiscal_year}-${c.status}`}>
                  <td className="py-2 font-mono text-slate-700 dark:text-slate-300">
                    FY{(c.fiscal_year ?? 0) % 100}
                  </td>
                  <td className="py-2">
                    <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    {formatNumber(c.n_leas)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    {formatNumber(c.n_leas_verified)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                    {formatDollars(c.total_amount, { forceUnit: "B" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-8 rounded-lg border border-slate-200 dark:border-slate-800 p-5 bg-slate-50/30 dark:bg-slate-900/30">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Citation suggestion
        </h2>
        <pre className="text-xs whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-mono">
{`School Spending Tracker. ${stateName} (${postal}) per-district
budget data, ${new Date().getFullYear()}. Retrieved from
https://school-spending-web.vercel.app/methodology/${postal}.`}
        </pre>
      </section>

      <section className="mb-8 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Programmatic access
        </h2>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
          {postal} data is available via the read-only{" "}
          <Link
            href="/api/v1"
            className="text-sky-600 dark:text-sky-400 hover:underline font-mono"
          >
            /api/v1
          </Link>{" "}
          REST surface and as bulk CSV downloads:
        </p>
        <ul className="space-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
          <li>
            <code>GET /api/v1/districts?state={postal}</code>
          </li>
          <li>
            <code>GET /api/v1/budget-events?state={postal}&fiscal_year=YYYY</code>
          </li>
          <li>
            <code>GET /api/v1/budget-event-components?state={postal}&category=instruction</code>
          </li>
          <li>
            <code>GET /api/v1/states/{postal}/coverage</code>
          </li>
          <li>
            <code>
              GET /api/v1/exports/budget-events.csv?fiscal_year=YYYY&state={postal}
            </code>
          </li>
        </ul>
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        <Link
          href={`/states/${postal}`}
          className="text-sky-600 dark:text-sky-400 hover:underline"
        >
          See {stateName} data →
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-base font-medium text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function TierBadge({
  tier,
  rationale,
}: {
  tier: string;
  rationale: string | null;
}) {
  const styles: Record<string, string> = {
    rich: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    moderate: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    thin: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    deferred:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  const labels: Record<string, string> = {
    rich: "Rich detail",
    moderate: "Moderate detail",
    thin: "Topline only",
    deferred: "Source deferred",
  };
  return (
    <span
      title={rationale ?? undefined}
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        styles[tier] ?? styles.deferred
      }`}
    >
      {labels[tier] ?? tier}
    </span>
  );
}

function ExtractorCard({ doc }: { doc: ExtractorDoc }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
          {doc.sourceFile}
        </code>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {doc.summary}
        </span>
      </div>
      <dl className="space-y-2 text-sm">
        {doc.publisher ? (
          <Row label="Publisher" value={doc.publisher} />
        ) : null}
        {doc.documentType ? (
          <Row
            label="Document type"
            value={<code className="font-mono text-xs">{doc.documentType}</code>}
          />
        ) : null}
        {doc.sourcePortalUrl ? (
          <Row
            label="Source portal"
            value={
              <a
                href={doc.sourcePortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:underline dark:text-sky-400 break-all"
              >
                {doc.sourcePortalUrl}
              </a>
            }
          />
        ) : null}
        {doc.toplineDefinition ? (
          <Row
            label="Topline definition"
            value={
              <span className="text-slate-700 dark:text-slate-300">
                {doc.toplineDefinition}
              </span>
            }
          />
        ) : null}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:w-32 shrink-0">
        {label}
      </dt>
      <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}
