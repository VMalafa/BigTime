"use client";

// The Bonus Moment's client seam on the server-first Home (#109): the
// card itself is unchanged; deciding refreshes the server render so the
// next Moment (or none) arrives as fresh server truth.

import { useRouter } from "next/navigation";
import {
  BonusMomentCard,
} from "@/components/dashboard/BonusMomentCard";
import type { BonusMomentCard as BonusMomentData } from "@/app/actions/bonus";

export function BonusMomentSection({ moment }: { moment: BonusMomentData }) {
  const router = useRouter();
  return (
    <BonusMomentCard
      // Keyed by Moment: the next windfall must mount fresh — the
      // previous card's optimistic-hidden state dies with its Moment.
      key={moment.id}
      moment={moment}
      onDecided={() => router.refresh()}
    />
  );
}
