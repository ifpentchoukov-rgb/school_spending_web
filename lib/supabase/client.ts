"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types";

/**
 * Supabase client for Client Components — Realtime subscriptions,
 * interactive forms, etc. The session lives in cookies; the same RLS
 * policies apply.
 */
export function getBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
