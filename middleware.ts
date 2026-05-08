import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/lib/types";

/**
 * Middleware:
 *   1. Refreshes the Supabase session on every request (so cookies set by
 *      the auth flow propagate to RSCs).
 *   2. Gates /admin/* — redirects unauthenticated users to /login, and
 *      non-researcher signed-in users to /admin/access-denied.
 */

const RESEARCHER_ROLES = new Set(["researcher", "admin"]);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: request.headers } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Force session refresh — required for auth state to be accurate in RSCs
  const { data: userResp } = await supabase.auth.getUser();
  const user = userResp?.user ?? null;

  const url = request.nextUrl.clone();

  // Auth gate for /admin/*
  if (url.pathname.startsWith("/admin")) {
    if (!user) {
      url.pathname = "/login";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    const role =
      (user.app_metadata?.role as string | undefined) ??
      (user.user_metadata?.role as string | undefined);
    if (!role || !RESEARCHER_ROLES.has(role)) {
      url.pathname = "/admin/access-denied";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Skip static assets, _next internals, and the public revalidate webhook.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/revalidate|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
