import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Local JWT verification (#109): getClaims() refreshes the session when
  // the access token has expired (rotated cookies flow through the
  // handlers above) and then verifies the JWT against the project's JWKS
  // locally — no per-request auth-server round trip. Legacy symmetric
  // keys fall back to a remote getUser() inside getClaims itself.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  // Protect dashboard, partner, and settings routes. /settings/connections
  // (bank data) is additionally gated on AAL2 by the page and every server
  // action it calls — the proxy only guarantees "authenticated at all",
  // since the connections page itself hosts the MFA enrollment/challenge UI.
  if (
    !claims &&
    (request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/partner") ||
      request.nextUrl.pathname.startsWith("/settings"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Signup-first (ratified in #29): the flow never renders anonymously.
  // Anonymous visitors are new households, so they land on signup — which
  // already returns to /flow after the account exists.
  if (!claims && request.nextUrl.pathname.startsWith("/flow")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signup";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
