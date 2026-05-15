/**
 * Detect requester tier + per-request identifier for rate limiting.
 *
 * Three authentication paths:
 *  1. No `Authorization` header → anonymous, identified by client IP.
 *  2. `Bearer ssk_<...>` opaque API key → resolve via api_keys table,
 *     tier inherited from the issuing user's allowlist + role claim.
 *  3. `Bearer <supabase_jwt>` short-lived session token → resolve via
 *     Supabase auth, tier from app_metadata.role + allowlist.
 *
 * Anonymous fall-through is the safe default if any verification step
 * fails — invalid token, revoked key, or unknown user.
 */

import { createHash } from "node:crypto";

import { getServerClient, getServiceRoleClient } from "@/lib/supabase/server";

import { clientIdentifier } from "./rate-limit";
import type { Tier } from "./response";

export type TierResolution = {
  tier: Tier;
  identifier: string;
};

export async function detectTier(request: Request): Promise<TierResolution> {
  const ip = clientIdentifier(request);
  const auth = request.headers.get("authorization");
  if (!auth) return { tier: "anonymous", identifier: ip };

  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { tier: "anonymous", identifier: ip };
  const token = match[1].trim();
  if (!token) return { tier: "anonymous", identifier: ip };

  // Path 1: opaque API key
  if (token.startsWith("ssk_")) {
    return resolveOpaqueKey(token, ip);
  }

  // Path 2: Supabase JWT
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) {
      return { tier: "anonymous", identifier: ip };
    }
    const userId = data.user.id;
    type UserAppMeta = { role?: string };
    const appMeta = (data.user.app_metadata ?? {}) as UserAppMeta;
    if (appMeta.role === "admin") {
      return { tier: "admin", identifier: `user:${userId}` };
    }
    const { data: row } = await supabase
      .from("researcher_allowlist")
      .select("email, revoked_at")
      .eq("email", data.user.email)
      .maybeSingle();
    if (row && !row.revoked_at) {
      return { tier: "researcher", identifier: `user:${userId}` };
    }
    // Authenticated but no special role — count against the anon bucket
    // but key on user_id so they get their own per-minute window.
    return { tier: "anonymous", identifier: `user:${userId}` };
  } catch {
    return { tier: "anonymous", identifier: ip };
  }
}

async function resolveOpaqueKey(
  token: string,
  fallbackIp: string,
): Promise<TierResolution> {
  // First 12 chars = "ssk_" + 8 random chars. Indexed on the api_keys
  // table so this is a single-row lookup; we still hash-compare the
  // full token to avoid timing leaks via prefix collision.
  const prefix = token.slice(0, 12);
  const hash = createHash("sha256").update(token).digest("hex");

  let supabase: ReturnType<typeof getServiceRoleClient>;
  try {
    supabase = getServiceRoleClient();
  } catch {
    // Service role not configured — can't authenticate the key at all.
    return { tier: "anonymous", identifier: fallbackIp };
  }

  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("user_id, key_hash, revoked_at")
    .eq("prefix", prefix)
    .is("revoked_at", null)
    .maybeSingle();
  if (!keyRow || keyRow.key_hash !== hash) {
    return { tier: "anonymous", identifier: fallbackIp };
  }

  // Resolve the issuing user's tier — admin > researcher > anon — using
  // the same rules as the JWT path so the answer is consistent.
  const userTier = await resolveTierForUserId(supabase, keyRow.user_id);
  // Update last_used_at (fire-and-forget; never block the request)
  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("prefix", prefix);
  return { tier: userTier, identifier: `key:${keyRow.user_id}` };
}

async function resolveTierForUserId(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userId: string,
): Promise<Tier> {
  // Use admin auth API to fetch the user record + its app_metadata. The
  // anon-key Supabase client can't do this cross-user lookup, hence the
  // service role.
  const { data: userRes } = await supabase.auth.admin.getUserById(userId);
  const user = userRes?.user;
  if (!user) return "anonymous";

  type UserAppMeta = { role?: string };
  const appMeta = (user.app_metadata ?? {}) as UserAppMeta;
  if (appMeta.role === "admin") return "admin";

  const email = user.email;
  if (!email) return "anonymous";
  const { data: row } = await supabase
    .from("researcher_allowlist")
    .select("email, revoked_at")
    .eq("email", email)
    .maybeSingle();
  if (row && !row.revoked_at) return "researcher";

  return "anonymous";
}

export function tierHeaders(tier: Tier): Record<string, string> {
  // Documentation-only headers describing the tier + intended limits.
  // Hard enforcement is in lib/api/rate-limit.ts::enforceRateLimit.
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
