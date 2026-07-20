import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

// Next.js renamed the `middleware` file convention to `proxy`; the session
// refresh + auth gating logic lives in lib/supabase/middleware.ts.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Authenticated surfaces only (#109): the public landing page, auth pages,
// calculator, API routes, and static assets bypass the proxy entirely —
// the marketing surface is as fast as a static page. Server-action POSTs
// target their page's URL, so writes under these prefixes still get the
// session-refresh behavior.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/partner/:path*",
    "/settings/:path*",
    "/flow/:path*",
  ],
};
