// The one auth verification per request (#109): every server entry point
// — server components, server actions, route handlers — resolves the
// signed-in user through this request-scoped cache. The first caller pays
// the Supabase round trip; everyone else in the same request reads the
// memo. A single Home render used to verify the same session ~8 times.
//
// "use server" exports remain public endpoints and must never take a
// caller-supplied userId — they call this guard themselves; only internal
// (non-action) helpers may accept the resolved identity as a parameter.

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** The request's verified Supabase user, resolved at most once. */
export const getRequestUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

/** Convenience for the common guard shape: the verified user's id. */
export async function getRequestUserId(): Promise<string | null> {
  const user = await getRequestUser();
  return user?.id ?? null;
}
