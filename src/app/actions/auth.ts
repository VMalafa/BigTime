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
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
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
