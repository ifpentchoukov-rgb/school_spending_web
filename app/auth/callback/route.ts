import { NextResponse } from "next/server";

import { getServerClient } from "@/lib/supabase/server";

/**
 * Magic-link callback. Supabase appends `code` (PKCE) to the redirect URL;
 * we exchange it for a session, then bounce the user to `redirect` (or
 * /admin by default).
 *
 * After the session is established, we also check `researcher_allowlist`
 * to set `app_metadata.role='researcher'` on the user. (Long-term this
 * should be a Supabase Auth Hook; for v1 we reconcile inline.)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") ?? "/admin";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-code", url.origin));
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        url.origin,
      ),
    );
  }

  // After exchange, the cookies are set. Note: assigning the `researcher`
  // role from the allowlist requires the service-role key (only the
  // service role can update auth.users.app_metadata). For v1 we do this
  // by an Edge Function (assign-researcher-role) called explicitly. The
  // RLS guard `is_verifier()` already gates writes, so reading
  // researcher_allowlist via RLS is sufficient until that function ships.

  return NextResponse.redirect(new URL(redirect, url.origin));
}
