// The Money Date's derived beats (#81, ratified in #62): four guided
// cards, everything derived live — nothing hardcoded. This module owns
// the deterministic pieces: the v1 insight rule (biggest categorized
// movement vs plan) and the moved-not-skipped Timeline override.

import type { MonthSummary } from "@/lib/spending/month-summary";
import type { MoneyMoment } from "@/lib/timeline/money-moments";

const BUCKET_NAMES: Record<string, string> = {
  FIXED_COSTS: "Fixed Costs",
  SAVINGS: "Savings",
  INVESTMENTS: "Investments",
  GUILT_FREE: "Guilt-Free Spending",
};

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * v1 insight rule, simple and deterministic: the bucket whose actual
 * share moved furthest from its plan share last month, named in dollars,
 * covered-by-default tone — a movement is information, not a verdict.
 */
export function deriveDateInsight(summary: MonthSummary): string {
  if (summary.incomeCents <= 0) {
    return "Not enough categorized spending last month to read a movement yet.";
  }
  let biggest: { bucket: string; deltaCents: number; over: boolean } | null =
    null;
  for (const bucket of summary.buckets) {
    const plannedCents = Math.round(
      (bucket.planPercent / 100) * summary.incomeCents
    );
    const deltaCents = bucket.actualCents - plannedCents;
    if (!biggest || Math.abs(deltaCents) > Math.abs(biggest.deltaCents)) {
      biggest = {
        bucket: bucket.bucket,
        deltaCents,
        over: deltaCents > 0,
      };
    }
  }
  if (!biggest || biggest.deltaCents === 0) {
    return "Last month landed on plan across every bucket — steady hands.";
  }
  const name = BUCKET_NAMES[biggest.bucket] ?? biggest.bucket;
  return biggest.over
    ? `${name} ran ${dollars(Math.abs(biggest.deltaCents))} over plan last month — the biggest movement, worth a look together.`
    : `${name} came in ${dollars(Math.abs(biggest.deltaCents))} under plan last month — the biggest movement, and it's in your favor.`;
}

export interface MoneyDateOverride {
  /** Date-only ISO of the payday that raised the Date. */
  periodStart: string;
  status: "RAISED" | "RESCHEDULED" | "COMPLETED";
  /** Date-only ISO; set when the Date moved to a chosen evening. */
  scheduledFor: string | null;
}

/**
 * Moved, never skipped (#62): a rescheduled Money Date's Timeline moment
 * renders on its chosen evening, saying so; a completed one reads kept.
 * Projected future Dates pass through untouched.
 */
export function applyMoneyDateOverrides(
  moments: MoneyMoment[],
  overrides: MoneyDateOverride[]
): MoneyMoment[] {
  const byPayday = new Map(overrides.map((o) => [o.periodStart, o]));
  const consumed = new Set<string>();
  const out = moments.map((moment) => {
    if (moment.kind !== "MONEY_DATE") return moment;
    const override = byPayday.get(moment.date);
    if (!override) return moment;
    consumed.add(override.periodStart);
    if (override.status === "COMPLETED") {
      return { ...moment, detail: "Kept — ten minutes, together ✓" };
    }
    if (override.status === "RESCHEDULED" && override.scheduledFor) {
      return {
        ...moment,
        date: override.scheduledFor,
        detail: `Moved from payday to your chosen evening — moved, never skipped`,
      };
    }
    return moment;
  });

  // The current period's payday is already behind us, so its projected
  // moment never existed — a moved Date still must render on its chosen
  // evening (moved, never skipped).
  for (const override of overrides) {
    if (consumed.has(override.periodStart)) continue;
    if (override.status !== "RESCHEDULED" || !override.scheduledFor) continue;
    out.push({
      kind: "MONEY_DATE",
      date: override.scheduledFor,
      title: "Money Date",
      detail: `Moved from payday to your chosen evening — moved, never skipped`,
    });
  }
  return out;
}
