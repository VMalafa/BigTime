"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { ProfileSwitcher } from "@/components/shared/ProfileSwitcher";
import { signOut } from "@/app/actions/auth";
import { useEffect, useState } from "react";
import { getActiveProfile } from "@/app/actions/profile";
import { useFlowStore } from "@/lib/store/flow-store";

// Marks that the anonymous-era flow draft was cleared after the draft
// layer's retirement (#48) — a one-time cleanup per browser.
const DRAFT_CLEARED_KEY = "rich-life-flow-draft-cleared";

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

  // Signup-first (#48): an anonymous-era draft may still sit in
  // localStorage. The DB rows stand as truth, so the draft is cleared once
  // on the first authed visit and never migrated or hydrated.
  useEffect(() => {
    if (isAuthenticated && !localStorage.getItem(DRAFT_CLEARED_KEY)) {
      useFlowStore.persist.clearStorage();
      localStorage.setItem(DRAFT_CLEARED_KEY, "1");
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
              <form
                action={async () => {
                  // Signout must leave no household data readable on this
                  // machine: reset the in-memory store first (a later set
                  // would re-persist it), then drop the persisted draft.
                  useFlowStore.getState().reset();
                  useFlowStore.persist.clearStorage();
                  await signOut();
                }}
              >
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
