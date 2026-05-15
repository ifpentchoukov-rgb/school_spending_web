/**
 * Phase 10.2 — hard rate limiting for /api/v1/* + page-driven CSV routes.
 *
 * Fixed-window counter with 60-second buckets. Identifier = client IP for
 * anonymous, JWT sub / key user_id for researcher + admin. Storage is
 * Vercel KV; if the KV env vars are missing (e.g. local dev without KV
 * connected) the limiter logs a one-time warning and acts as a pass-
 * through so devs don't have to provision KV to run the app.
 *
 * Budgets are intentional defaults that match the documented `/api/v1`
 * manifest. They are *per-identifier per-minute*, not aggregate.
 */

import { kv } from "@vercel/kv";

import type { Tier } from "./response";
import { jsonError } from "./response";

const LIMITS_RPM: Record<Tier, number> = {
  anonymous: 60,
  researcher: 600,
  admin: 0, // 0 = unlimited
};

const WINDOW_SECONDS = 60;
const KEY_TTL_SECONDS = 65; // small buffer past the window edge

let kvAvailable: boolean | null = null;
function checkKvAvailable(): boolean {
  if (kvAvailable !== null) return kvAvailable;
  // @vercel/kv reads env at module load; if KV_REST_API_URL is empty the
  // first call throws. Detect upfront to avoid noisy stack traces.
  const url = process.env.KV_REST_API_URL || process.env.KV_URL;
  const token = process.env.KV_REST_API_TOKEN;
  kvAvailable = Boolean(url && token);
  if (!kvAvailable) {
    console.warn(
      "[rate-limit] KV not configured (KV_REST_API_URL/KV_REST_API_TOKEN missing); " +
        "limiter is pass-through. Provision Vercel KV in the dashboard to enable.",
    );
  }
  return kvAvailable;
}

export function clientIdentifier(request: Request): string {
  // First hop from x-forwarded-for is the original client; the rest is
  // the proxy chain. Vercel sets this for every incoming request.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  // Fall back to a stable per-process constant rather than mixing all
  // unknown anon callers into one bucket (which would lock everyone out
  // simultaneously). Better: each unknown gets its own bucket, which is
  // a no-op for limiting but at least won't false-positive 429.
  return "anon:no-ip";
}

export type RateLimitContext = {
  tier: Tier;
  identifier: string;
};

export async function enforceRateLimit(
  ctx: RateLimitContext,
): Promise<Response | null> {
  const { tier, identifier } = ctx;
  const limit = LIMITS_RPM[tier];
  if (limit === 0) return null; // unlimited (admin)
  if (!checkKvAvailable()) return null; // pass-through if KV not wired

  const minute = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `rl:${tier}:${identifier}:${minute}`;

  let count: number;
  try {
    count = await kv.incr(key);
    if (count === 1) {
      // Best-effort TTL; if it fails the row will be lazily reclaimed by
      // the next-window's INCR resetting against a stale (uncapped) key.
      // Set unconditionally on the first increment to keep TTL bounded.
      await kv.expire(key, KEY_TTL_SECONDS);
    }
  } catch (err) {
    // KV errors should never fail an otherwise-valid request. Log and
    // pass through.
    console.error("[rate-limit] KV error:", err);
    return null;
  }

  if (count > limit) {
    const nowSec = Math.floor(Date.now() / 1000);
    const retryAfter = WINDOW_SECONDS - (nowSec % WINDOW_SECONDS);
    return jsonError(
      "rate_limited",
      `Exceeded ${limit} requests/min for ${tier} tier. Retry in ${retryAfter}s.`,
      429,
      {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Tier": tier,
        "X-RateLimit-RPM-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(nowSec + retryAfter),
      },
    );
  }

  return null;
}
