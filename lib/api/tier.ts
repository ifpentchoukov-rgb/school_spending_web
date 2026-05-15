/**
 * Detect requester tier from headers. v1: looks for a Bearer token and
 * matches the email claim against `researcher_allowlist`. v2 will add a
 * dedicated API-key issuance flow (Phase 10.2).
 *
 * Hard rate limiting is deferred to a separate task — it needs Vercel
 * KV / Upstash. For now we surface the tier via `X-RateLimit-Tier`
 * header and document the intended limits in the OpenAPI manifest.
 */

import { getServerClient } from "@/lib/supabase/server";

import type { Tier } from "./response";

export async function detectTier(request: Request): Promise<Tier> {
  const auth = request.headers.get("authorization");
  if (!auth) return "anonymous";

  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return "anonymous";
  const token = match[1].trim();
  if (!token) return "anonymous";

  // Use the Supabase server client to identify the bearer's user. The
  // server helper authenticates as service-role for queries; we just
  // need to validate the JWT.
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) return "anonymous";

    // Admin override via app_metadata role claim — set by Phase 9 auth
    // hook (custom_access_token_hook). If we can't read app_metadata
    // here, fall through to allowlist check.
    type UserAppMeta = { role?: string };
    const appMeta = (data.user.app_metadata ?? {}) as UserAppMeta;
    if (appMeta.role === "admin") return "admin";

    // Researcher tier: email in researcher_allowlist + not revoked.
    const { data: row } = await supabase
      .from("researcher_allowlist")
      .select("email, revoked_at")
      .eq("email", data.user.email)
      .maybeSingle();
    if (row && !row.revoked_at) return "researcher";

    return "anonymous";
  } catch {
    return "anonymous";
  }
}

export function tierHeaders(tier: Tier): Record<string, string> {
  // Documentation-only headers. Hard limiting via Vercel KV is on the
  // roadmap; this surfaces the intended limits for callers.
  const docs: Record<Tier, { rpm: number; max_page_size: number }> = {
    anonymous: { rpm: 60, max_page_size: 500 },
    researcher: { rpm: 600, max_page_size: 5000 },
    admin: { rpm: 0, max_page_size: 5000 }, // 0 = unlimited
  };
  const d = docs[tier];
  return {
    "X-RateLimit-Tier": tier,
    "X-RateLimit-RPM-Limit": String(d.rpm),
    "X-RateLimit-MaxPageSize": String(d.max_page_size),
  };
}
