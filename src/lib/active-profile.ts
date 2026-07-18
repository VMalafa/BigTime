// Server-side resolution of the household's active Profile: the
// `active-profile-id` cookie when it names a profile the signed-in user
// owns, else the default profile. Shared by the per-intent action modules.

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_PROFILE_COOKIE = "active-profile-id";

export async function getActiveProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const profileId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;
  if (profileId) {
    const exists = await prisma.profile.findFirst({
      where: { id: profileId, userId: user.id },
      select: { id: true },
    });
    if (exists) return profileId;
  }

  const defaultProfile = await prisma.profile.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { id: true },
  });
  return defaultProfile?.id ?? null;
}
