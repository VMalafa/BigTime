"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function getSiteUrl(): Promise<string> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl;

  // Derive from request headers when env var is not set
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

// User-facing copy shown when the Supabase auth backend can't be reached
// (e.g. a paused/offline project, which otherwise surfaces as a raw browser
// "ERR_NAME_NOT_RESOLVED" page the app has no control over).
const AUTH_UNAVAILABLE_MESSAGE =
  "We couldn't reach the sign-in service. It may be temporarily offline — please try again in a minute.";

// Ping the Supabase GoTrue health endpoint so we can fail with a clear,
// in-app message instead of redirecting the user off-site to a dead host.
async function isSupabaseReachable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    // Hosted Supabase gates /auth/v1/* behind its API gateway, which 401s
    // any request without an apikey header — including /health.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    await fetch(`${url}/auth/v1/health`, {
      cache: "no-store",
      signal: controller.signal,
      headers: anonKey ? { apikey: anonKey } : undefined,
    });
    clearTimeout(timeout);
    // Any HTTP response proves the host is up; a paused/offline project
    // surfaces as a DNS error or timeout, not a status code.
    return true;
  } catch {
    // DNS failure, timeout, or network error — treat as unreachable.
    return false;
  }
}

// Distinguish "backend unreachable" from a genuine bad-credentials response so
// we don't tell the user their password is wrong when the service is down.
function isConnectivityError(error: { name?: string; status?: number }): boolean {
  return error.name === "AuthRetryableFetchError" || error.status === 0;
}

export async function createUserAndProfile(
  supabaseUserId: string,
  email: string,
  name: string
) {
  const user = await prisma.user.create({
    data: {
      id: supabaseUserId,
      email,
      name,
      profiles: {
        create: {
          name,
          isDefault: true,
        },
      },
    },
    include: { profiles: true },
  });

  return user;
}

export async function signUp(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/flow";

  if (!name || !email || !password) {
    return { error: "All fields are required." };
  }
  // ADR-0002: one shared login guards the household's bank-linked data, so
  // the password must be passphrase-strength.
  if (password.length < 12) {
    return {
      error:
        "Password must be at least 12 characters. Try a passphrase — a few random words is both stronger and easier to remember.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    try {
      await createUserAndProfile(data.user.id, email, name);
    } catch (dbError: unknown) {
      // If Prisma user already exists (e.g. race condition), continue
      const msg = dbError instanceof Error ? dbError.message : "";
      if (!msg.includes("Unique constraint")) {
        return { error: "Failed to create account. Please try again." };
      }
    }
  }

  redirect(redirectTo);
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  // supabase-js can throw on network failures rather than returning an error.
  const result = await supabase.auth
    .signInWithPassword({ email, password })
    .catch(() => null);

  if (result === null) {
    return { error: AUTH_UNAVAILABLE_MESSAGE };
  }

  const { error } = result;

  if (error) {
    if (isConnectivityError(error)) {
      return { error: AUTH_UNAVAILABLE_MESSAGE };
    }
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInWithGoogle(): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // Auth isn't configured — surface a clear message instead of a broken flow.
    redirect("/auth/login?error=config");
  }

  // signInWithOAuth only *builds* the provider URL; it never checks that the
  // Supabase host is reachable. If the project is paused/offline, redirecting
  // to that URL dumps the user on a raw browser DNS error. Preflight the
  // backend so we can show an in-app message instead.
  if (!(await isSupabaseReachable())) {
    redirect("/auth/login?error=service_unavailable");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    // OAuth initiation failed — redirect to login with error
    redirect("/auth/login?error=oauth_failed");
  }

  if (data.url) {
    redirect(data.url);
  }
}
