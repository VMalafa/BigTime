// Server-side resolution of the household's active Profile: the
// `active-profile-id` cookie when it names a profile the signed-in user
// owns, else the default profile. Shared by the per-intent action modules.
// Request-scoped (#109): the auth verification comes from the shared
// request guard, and the profile lookup itself resolves at most once per
// request — a mutation-heavy action chain used to re-run both per call.

import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/auth/request-user";

const ACTIVE_PROFILE_COOKIE = "active-profile-id";

export const getActiveProfileId = cache(async (): Promise<string | null> => {
  const userId = await getRequestUserId();
  if (!userId) return null;

  const cookieStore = await cookies();
  const profileId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;
  if (profileId) {
    const exists = await prisma.profile.findFirst({
      where: { id: profileId, userId },
      select: { id: true },
    });
    if (exists) return profileId;
  }

  const defaultProfile = await prisma.profile.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });
  return defaultProfile?.id ?? null;
});
