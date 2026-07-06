import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUserAndProfile } from "@/app/actions/auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Create Prisma User + Profile if first sign-in
      try {
        await createUserAndProfile(
          data.user.id,
          data.user.email ?? "",
          data.user.user_metadata?.full_name ??
            data.user.email?.split("@")[0] ??
            "User"
        );
      } catch {
        // User already exists (returning OAuth sign-in) — continue
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`);
}
