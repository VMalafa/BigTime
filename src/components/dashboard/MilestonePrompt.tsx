"use client";

// The one-time celebration prompt (#86) as a client leaf of the
// server-first Home (#109): the Milestone arrives as a prop from the
// server render; only the accept/dismiss interaction lives here.
// Optimistic hide + rollback; never re-raised either way.

import { useState } from "react";
import { decideMilestone, type MilestoneData } from "@/app/actions/goals";

export function MilestonePrompt({ milestone }: { milestone: MilestoneData }) {
  const [hidden, setHidden] = useState(false);

  async function handleMilestone(decision: "ACCEPTED" | "DISMISSED") {
    setHidden(true);
    const result = await decideMilestone({ id: milestone.id, decision });
    if (result.error) setHidden(false);
  }

  if (hidden) return null;

  return (
    <div
      data-milestone-prompt
      className="mb-4 rounded-xl border border-accent-gold/50 bg-accent-gold/10 px-4 py-3 text-center"
    >
      <p className="text-sm font-sans font-medium text-text-primary">
        🎉 {milestone.title}
      </p>
      {milestone.detail && (
        <p className="text-xs font-sans text-text-secondary mt-0.5">
          {milestone.detail}
        </p>
      )}
      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => handleMilestone("ACCEPTED")}
          className="rounded-full bg-text-primary px-4 py-1 text-xs font-sans font-medium text-white hover:bg-text-primary/90 transition-colors"
        >
          Celebrate it — ${Math.round(milestone.celebrationBudgetCents / 100)}{" "}
          of guilt-free
        </button>
        <button
          type="button"
          onClick={() => handleMilestone("DISMISSED")}
          className="text-xs font-sans text-text-secondary hover:text-text-primary transition-colors"
        >
          Not this one
        </button>
      </div>
    </div>
  );
}
