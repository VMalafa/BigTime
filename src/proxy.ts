import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

// Next.js renamed the `middleware` file convention to `proxy`; the session
// refresh + auth gating logic lives in lib/supabase/middleware.ts.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
