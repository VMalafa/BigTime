"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { ProfileSwitcher } from "@/components/shared/ProfileSwitcher";
import { signOut } from "@/app/actions/auth";
import { useEffect, useState } from "react";
import { getActiveProfile } from "@/app/actions/profile";

export function AppHeader() {
  const { isAuthenticated, loading } = useAuth();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      getActiveProfile().then((profile) => {
        if (profile) setActiveProfileId(profile.id);
      });
    }
  }, [isAuthenticated]);

  if (loading) return null;

  return (
    <header className="border-b border-bg-secondary bg-white">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-lg text-text-primary hover:text-accent-gold transition-colors"
        >
          Your Rich Life
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <>
              <ProfileSwitcher activeProfileId={activeProfileId} />
              <Link
                href="/dashboard"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Dashboard
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          )}
          {!isAuthenticated && (
            <Link
              href="/auth/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
