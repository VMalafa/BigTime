"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getRequestUser } from "@/lib/auth/request-user";

const MAX_PROFILES = 2;
const ACTIVE_PROFILE_COOKIE = "active-profile-id";

export async function getProfiles() {
  const user = await getRequestUser();

  if (!user) return [];

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return profiles;
}

export async function getActiveProfile() {
  const user = await getRequestUser();

  if (!user) return null;

  const cookieStore = await cookies();
  const activeProfileId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;

  if (activeProfileId) {
    const profile = await prisma.profile.findFirst({
      where: { id: activeProfileId, userId: user.id },
    });
    if (profile) return profile;
  }

  // Fallback to default profile
  const defaultProfile = await prisma.profile.findFirst({
    where: { userId: user.id, isDefault: true },
  });

  return defaultProfile;
}

export async function switchProfile(profileId: string) {
  const user = await getRequestUser();

  if (!user) return { error: "Not authenticated" };

  // Verify profile belongs to this user
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: user.id },
  });

  if (!profile) return { error: "Profile not found" };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function addPartnerProfile(formData: FormData) {
  const name = formData.get("name") as string;

  if (!name || name.trim().length === 0) {
    return { error: "Name is required." };
  }

  const user = await getRequestUser();

  if (!user) return { error: "Not authenticated." };

  const existingProfiles = await prisma.profile.count({
    where: { userId: user.id },
  });

  if (existingProfiles >= MAX_PROFILES) {
    return { error: "Maximum of 2 profiles per household." };
  }

  const profile = await prisma.profile.create({
    data: {
      userId: user.id,
      name: name.trim(),
      isDefault: false,
    },
  });

  revalidatePath("/", "layout");
  return { success: true, profileId: profile.id };
}
