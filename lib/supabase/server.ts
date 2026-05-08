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
