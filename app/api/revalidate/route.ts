import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

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
  });
}

// Allow GET for a quick health check.
export async function GET() {
  return NextResponse.json({
    ok: true,
    note: "POST a Supabase webhook payload to this endpoint.",
  });
}
