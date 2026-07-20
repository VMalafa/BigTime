"use client";

// The "know yourselves" side-quest (#73) as a client leaf of the
// server-first Home (#109): visibility is decided by the server render;
// only dismiss-forever lives here. Optimistic hide, rollback if the
// server says no.

import { useState } from "react";
import Link from "next/link";
import { dismissSideQuest } from "@/app/actions/setup";
import { invalidateSetupState } from "@/lib/setup/client-cache";

export function SideQuestCard() {
  const [hidden, setHidden] = useState(false);

  async function handleDismiss() {
    setHidden(true);
    const result = await dismissSideQuest();
    if (result.error) {
      setHidden(false);
    } else {
      invalidateSetupState();
    }
  }

  if (hidden) return null;

  return (
    <div
      data-side-quest
      className="mb-6 rounded-xl border border-bg-secondary bg-white px-4 py-3"
    >
      <p className="text-sm font-sans text-text-primary">
        When you have 20 calm minutes: the know-yourselves pair — your Money
        Scripts and Money Type.
      </p>
      <div className="mt-2 flex items-center gap-4">
        <Link
          href="/flow/scripts"
          className="text-sm font-sans font-medium text-accent-gold-deep hover:underline"
        >
          Start the side-quest →
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs font-sans text-text-secondary hover:text-text-primary transition-colors"
        >
          Not now — don&apos;t ask again
        </button>
      </div>
    </div>
  );
}
