"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProfileSwitcher } from "@/components/shared/ProfileSwitcher";
import { signOut } from "@/app/actions/auth";
import { getActiveProfile } from "@/app/actions/profile";
import { useFlowStore } from "@/lib/store/flow-store";

// Marks that the anonymous-era flow draft was cleared after the draft
// layer's retirement (#48) — a one-time cleanup per browser.
const DRAFT_CLEARED_KEY = "rich-life-flow-draft-cleared";

// The header renders with the page (#109): the bar itself is in the
// server HTML — it no longer returns null until auth resolves, so the
// layout never visibly shifts. The auth affordances resolve from the
// LOCAL cookie-backed session (no auth-server round trip): they are
// links, not a security boundary — every server action verifies the
// session for real. Reading the session on the server here was rejected
// deliberately: the header lives in the root layout, and a cookies()
// read there would flip every statically-prerendered route (including
// the landing, #109 WS6) to dynamic rendering.
export function AppHeader() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => setAuthed(data.session !== null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setAuthed(session !== null)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authed) {
      getActiveProfile().then((profile) => {
        if (profile) setActiveProfileId(profile.id);
      });
    }
  }, [authed]);

  // Signup-first (#48): an anonymous-era draft may still sit in
  // localStorage. The DB rows stand as truth, so the draft is cleared once
  // on the first authed visit and never migrated or hydrated.
  useEffect(() => {
    if (authed && !localStorage.getItem(DRAFT_CLEARED_KEY)) {
      useFlowStore.persist.clearStorage();
      localStorage.setItem(DRAFT_CLEARED_KEY, "1");
    }
  }, [authed]);

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
          {authed === true && (
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
          {authed === false && (
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
