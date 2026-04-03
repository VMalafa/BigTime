"use client";

import { useEffect, useState, useTransition } from "react";
import { getProfiles, switchProfile } from "@/app/actions/profile";

interface Profile {
  id: string;
  name: string;
  isDefault: boolean;
}

export function ProfileSwitcher({
  activeProfileId,
}: {
  activeProfileId: string | null;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getProfiles().then(setProfiles);
  }, []);

  if (profiles.length < 2) return null;

  function handleSwitch(profileId: string) {
    startTransition(async () => {
      await switchProfile(profileId);
      // Page will revalidate via revalidatePath in the action
    });
  }

  return (
    <div className="flex items-center gap-2">
      {profiles.map((profile) => {
        const isActive = profile.id === activeProfileId;
        return (
          <button
            key={profile.id}
            onClick={() => handleSwitch(profile.id)}
            disabled={isPending || isActive}
            className={`
              px-3 py-1.5 rounded-full text-sm font-sans font-medium transition-all
              ${
                isActive
                  ? "bg-accent-gold text-white"
                  : "bg-bg-secondary text-text-secondary hover:bg-bg-secondary/80"
              }
              ${isPending ? "opacity-50" : ""}
            `}
          >
            {profile.name}
          </button>
        );
      })}
    </div>
  );
}
