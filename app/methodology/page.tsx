import Link from "next/link";

import extractorDocs from "@/lib/extractor-docs.json";
import { getStateName } from "@/lib/state-meta";

export const dynamic = "force-static";
export const revalidate = false; // built-in only at build time

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

const ALL_DOCS = Object.entries(docs)
  .filter(([, d]) => d.state) // skip if STATE not extractable
  .map(([key, d]) => ({ key, ...d }))
  .sort((a, b) => {
    const sa = a.state ?? "";
    const sb = b.state ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return a.key.localeCompare(b.key);
  });

export default function MethodologyPage() {
  const byState = new Map<string, typeof ALL_DOCS>();
  for (const d of ALL_DOCS) {
    const k = d.state ?? "??";
    const arr = byState.get(k) ?? [];
    arr.push(d);
    byState.set(k, arr);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Methodology
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          How toplines are computed for each state, how source documents are
          captured and hashed, and what the F-33 'current expenditures' frame
          means in this project. This page is auto-generated from the
          extractor module docstrings — every entry traces back to a specific
          file in the{" "}
          <a
            href="https://github.com/ifpentchoukov-rgb/school_spending"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:underline dark:text-sky-400"
          >
            extractors repo
          </a>
          .
        </p>
      </header>

      <section className="mb-10 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          F-33 'current expenditures' frame
        </h2>
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
          <p>
            We aim to express each state's topline in the U.S. Census
            <em>F-33 'current expenditures'</em> frame: instructional services,
            instructional support, operations &amp; maintenance, student
            transportation, food services, and other operating support.
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            Excluded by definition: capital outlay, debt service, and payments
            to other school systems.
          </p>
        </div>
      </section>

      <section className="mb-10 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Source-document provenance
        </h2>
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
          <p>
            Every extracted budget event records the exact file it came from in
            the <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
              source_documents
            </code>{" "}
            table — including a SHA-256 of the raw bytes, the publisher, the
            line-or-cell reference within the file (e.g. "approp{"{YY}"}.csv;
            sum amount_3 where line_no in (72260, 88760)"), and the original
            URL we fetched.
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            The same hash dedupes refetches, so re-running an extractor against
            an unchanged source produces zero new rows — but if the source
            changes, the hash differs, a new <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
              source_documents
            </code>{" "}
            row is inserted, and the resulting budget event supersedes the
            prior one (audit trail in <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
              verification_log
            </code>
            ).
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          State-by-state extractor catalog ({ALL_DOCS.length} extractors)
        </h2>

        <div className="space-y-4">
          {Array.from(byState.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([state, items]) => (
              <details
                key={state}
                className="group rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <summary className="cursor-pointer px-5 py-3 flex items-center justify-between text-sm hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold inline-flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 w-9 h-6">
                      {state}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {getStateName(state)}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {items.length} extractor{items.length === 1 ? "" : "s"}
                  </span>
                </summary>
                <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 space-y-5">
                  {items.map((doc) => (
                    <ExtractorCard key={doc.key} doc={doc} stateName={getStateName(state)} />
                  ))}
                  <Link
                    href={`/states/${state}`}
                    className="inline-block text-xs text-sky-600 hover:underline dark:text-sky-400"
                  >
                    See {getStateName(state)} data →
                  </Link>
                </div>
              </details>
            ))}
        </div>
      </section>
    </div>
  );
}

function ExtractorCard({
  doc,
  stateName,
}: {
  doc: ExtractorDoc & { key: string };
  stateName: string;
}) {
  return (
    <div className="text-sm">
      <div className="flex items-baseline gap-2 mb-2">
        <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
          {doc.sourceFile}
        </code>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {doc.summary.replace(`${stateName} extractor — `, "")}
        </span>
      </div>
      <dl className="space-y-2">
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
