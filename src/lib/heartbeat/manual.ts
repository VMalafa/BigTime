// Manual-fuel heartbeat (#73): one flow, two fuels — a household that
// skipped (or failed) linking still finishes setup on manual entries, and
// the exit condition is a REAL Safe-to-Spend. Without a feed there are no
// paychecks to bound a Pay Period, so the manual period is the calendar
// month: income = the stated monthly total, and every fixed-cost line
// item is reserved against the month (no charge patterns exist to date
// them — reserving all of them is the honest reading of "fixed").
// The moment a linked paycheck lands, the feed-bounded heartbeat takes
// over and this projection retires.

export interface ManualHeartbeat {
  safeToSpendCents: number;
  paycheckCents: number;
  earmarkedCents: number;
  plannedSavingsInvestmentsCents: number;
  /** Calendar-month bounds (UTC). */
  periodStart: Date;
  periodEndExclusive: Date;
  /** Line items reserved without a feed-detected due date. */
  undated: { name: string; monthlyAmountCents: number }[];
}

export function computeManualHeartbeat(input: {
  monthlyIncomeCents: number;
  lineItems: { name: string; monthlyAmountCents: number }[];
  plan: { savingsPercent: number; investmentsPercent: number } | null;
  now: Date;
}): ManualHeartbeat | null {
  if (input.monthlyIncomeCents <= 0) return null;

  const year = input.now.getUTCFullYear();
  const month = input.now.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1));
  const periodEndExclusive = new Date(Date.UTC(year, month + 1, 1));

  const earmarkedCents = input.lineItems.reduce(
    (sum, item) => sum + item.monthlyAmountCents,
    0
  );
  const plannedShare = input.plan
    ? (input.plan.savingsPercent + input.plan.investmentsPercent) / 100
    : 0;
  const plannedSavingsInvestmentsCents = Math.round(
    input.monthlyIncomeCents * plannedShare
  );

  return {
    safeToSpendCents:
      input.monthlyIncomeCents - earmarkedCents - plannedSavingsInvestmentsCents,
    paycheckCents: input.monthlyIncomeCents,
    earmarkedCents,
    plannedSavingsInvestmentsCents,
    periodStart,
    periodEndExclusive,
    undated: input.lineItems,
  };
}
