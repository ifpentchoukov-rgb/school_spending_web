import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/types";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server
 * Actions. Reads + writes the user's session cookies via Next's `cookies()`
 * API. RLS policies on the database side enforce row-level visibility.
 *
 * Usage (in an RSC):
 *   const supabase = await getServerClient();
 *   const { data } = await supabase.from("districts").select("*").limit(10);
 */
/**
 * Service-role Supabase client. Bypasses RLS. Use only inside route
 * handlers / server actions where we genuinely need cross-user visibility
 * (e.g. authenticating an inbound API key lookup before the user's
 * tier is even known).
 *
 * Throws if SUPABASE_SERVICE_ROLE_KEY is not set so misconfigured
 * deploys fail loudly rather than silently degrading to anon access.
 */
export function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "getServiceRoleClient: NEXT_PUBLIC_SUPABASE_URL or " +
        "SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Middleware refreshes
            // the session — safe to ignore here.
          }
        },
      },
    },
  );
}
