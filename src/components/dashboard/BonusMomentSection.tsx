"use client";

// The Bonus Moment's client seam on the server-first Home (#109): the
// card itself is unchanged. Deciding calls revalidatePath("/dashboard")
// inside the action, so the action's own response already carries the
// refreshed server render — the next Moment (or none) swaps in without
// an extra router.refresh(), which would only queue a second full Home
// read behind the one the action just did.

import { BonusMomentCard } from "@/components/dashboard/BonusMomentCard";
import type { BonusMomentCard as BonusMomentData } from "@/app/actions/bonus";

export function BonusMomentSection({ moment }: { moment: BonusMomentData }) {
  return (
    <BonusMomentCard
      // Keyed by Moment: the next windfall must mount fresh — the
      // previous card's optimistic-hidden state dies with its Moment.
      key={moment.id}
      moment={moment}
      onDecided={() => {}}
    />
  );
}
