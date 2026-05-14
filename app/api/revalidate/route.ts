import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import extractorDocs from "@/lib/extractor-docs.json";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Webhook target for Supabase database webhooks. Fires whenever
 * `budget_events` is INSERTed or UPDATEd, or whenever `extraction_runs`
 * is UPDATEd.
 *
 * Configuration (in Supabase dashboard → Database → Webhooks):
 *   Name:      revalidate-website
 *   Table:     budget_events  (and a second webhook for extraction_runs)
 *   Events:    INSERT, UPDATE
 *   Method:    POST
 *   URL:       https://schoolspending.app/api/revalidate
 *   Headers:   x-webhook-secret: <SUPABASE_WEBHOOK_SECRET env value>
 *
 * Payload shape (Supabase webhook standard):
 *   { type: "INSERT" | "UPDATE" | "DELETE",
 *     table: string,
 *     schema: string,
 *     record: <new row>,
 *     old_record?: <previous row> }
 *
 * The handler is idempotent — repeated calls for the same event are
 * safe (revalidatePath just marks the path stale).
 */

type SupabaseWebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

const SECRET = process.env.SUPABASE_WEBHOOK_SECRET;
const DISPATCH_TOKEN = process.env.GITHUB_REPO_DISPATCH_TOKEN;

const DISPATCH_OWNER = "ifpentchoukov-rgb";
const DISPATCH_REPO = "school_spending";
const DISPATCH_WORKFLOW = "daily.yml";
const DISPATCH_REF = "main";

type ExtractorDocsShape = Record<string, { module: string; state: string | null }>;
const docs = extractorDocs as ExtractorDocsShape;

/** Look up a state postal for an `extractors.foo` module name. */
function statePostalForModule(module: string): string | null {
  const key = module.replace(/^extractors\./, "");
  return docs[key]?.state ?? null;
}

/**
 * Dispatch the daily extractor workflow against a single state. Uses
 * `--include-actuals` so an `actuals`-kind extractor isn't silently
 * skipped. Returns null on success or an error string.
 */
async function dispatchWorkflow(input: {
  state: string;
  fiscalYear: number | null;
}): Promise<string | null> {
  if (!DISPATCH_TOKEN) return "GITHUB_REPO_DISPATCH_TOKEN not configured";
  const url = `https://api.github.com/repos/${DISPATCH_OWNER}/${DISPATCH_REPO}/actions/workflows/${DISPATCH_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${DISPATCH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: DISPATCH_REF,
      inputs: {
        fiscal_year: String(input.fiscalYear ?? 2027),
        states: input.state,
        include_actuals: "true",
      },
    }),
  });
  if (res.status === 204) return null;
  const body = await res.text().catch(() => "");
  return `GitHub dispatch failed: ${res.status} ${body.slice(0, 200)}`;
}

export async function POST(req: Request) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "SUPABASE_WEBHOOK_SECRET not configured on server" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("x-webhook-secret");
  if (sig !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = (await req.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const paths = new Set<string>();
  const tags = new Set<string>();
  let dispatchedRun: { state: string; error: string | null } | null = null;

  // Dispatch the GitHub Actions workflow on freshly-queued triggers.
  // The trigger row stays as status='queued' for now — the dispatched
  // workflow writes its own extraction_runs row when it finishes, and
  // /admin/runs picks that up. (Future: update trigger.status once we
  // wire SUPABASE_SERVICE_ROLE_KEY for the route to write to RLS-gated
  // tables.)
  if (
    payload.table === "extractor_triggers" &&
    payload.type === "INSERT" &&
    payload.record &&
    payload.record.status === "queued"
  ) {
    const module = payload.record.module as string | undefined;
    const fiscalYear = (payload.record.fiscal_year as number | null) ?? null;
    const state = module ? statePostalForModule(module) : null;
    if (state) {
      const err = await dispatchWorkflow({ state, fiscalYear });
      dispatchedRun = { state, error: err };
    } else {
      dispatchedRun = {
        state: "?",
        error: `Could not resolve state postal for module=${module ?? "(none)"}`,
      };
    }
  }

  if (payload.table === "budget_events" && payload.record) {
    const leaid = payload.record.leaid as string | undefined;
    const isSuperseded = payload.record.is_superseded as boolean | undefined;
    if (leaid && isSuperseded === false) {
      const supabase = await getServerClient();
      const { data: district } = await supabase
        .from("districts")
        .select("state_postal")
        .eq("leaid", leaid)
        .maybeSingle();
      if (district?.state_postal) {
        paths.add(`/states/${district.state_postal}`);
        paths.add(`/states/${district.state_postal}/${leaid}`);
      }
    }
    tags.add("coverage-dashboard");
  } else if (payload.table === "extraction_runs") {
    paths.add("/admin/runs");
    tags.add("coverage-dashboard");
  } else if (payload.table === "extractor_triggers") {
    paths.add("/admin/runs");
  }

  // Always revalidate the homepage's coverage card.
  paths.add("/");

  // Next 16 requires a cache-life profile on revalidateTag. "default"
  // matches the default page cache profile.
  for (const p of paths) revalidatePath(p, "page");
  for (const t of tags) revalidateTag(t, "default");

  return NextResponse.json({
    ok: true,
    revalidated: { paths: Array.from(paths), tags: Array.from(tags) },
    dispatched: dispatchedRun,
  });
}

// Allow GET for a quick health check.
export async function GET() {
  return NextResponse.json({
    ok: true,
    note: "POST a Supabase webhook payload to this endpoint.",
  });
}
