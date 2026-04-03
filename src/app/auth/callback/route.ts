import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    // Will handle Supabase auth exchange here
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
