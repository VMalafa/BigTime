// The Moment's concrete numbers (#89): payoff impact in months and
// Spotlight Goal impact ("34% → 41%"), shown in real dollars so found
// money gets one calm decision instead of a debate. ADR-0001 stands: the
// app computes impact; it never moves the money.

export interface PayoffImpact {
  monthsBefore: number;
  monthsAfter: number;
  monthsSaved: number;
}

const MAX_MONTHS = 600;

/** Months to zero at the minimum payment, monthly-compounded APR. Null when
 * the balance never amortizes (interest ≥ payment) or inputs are unusable. */
function monthsToPayoff(
  balanceCents: number,
  aprPercent: number,
  minimumPaymentCents: number
): number | null {
  if (balanceCents <= 0) return 0;
  if (minimumPaymentCents <= 0) return null;
  const monthlyRate = aprPercent / 12 / 100;
  let balance = balanceCents;
  let month = 0;
  while (balance > 0 && month < MAX_MONTHS) {
    month++;
    const interest = balance * monthlyRate;
    if (interest >= minimumPaymentCents) return null;
    balance = balance + interest - minimumPaymentCents;
  }
  return balance > 0 ? null : month;
}

/** What the debt share of a windfall does to the target debt's timeline. */
export function payoffImpact(
  debt: {
    balanceCents: number;
    aprPercent: number;
    minimumPaymentCents: number;
  },
  extraCents: number
): PayoffImpact | null {
  const before = monthsToPayoff(
    debt.balanceCents,
    debt.aprPercent,
    debt.minimumPaymentCents
  );
  if (before === null || before === 0) return null;
  const after = monthsToPayoff(
    Math.max(0, debt.balanceCents - extraCents),
    debt.aprPercent,
    debt.minimumPaymentCents
  );
  if (after === null) return null;
  return {
    monthsBefore: before,
    monthsAfter: after,
    monthsSaved: Math.max(0, before - after),
  };
}

export interface GoalImpact {
  beforePercent: number;
  afterPercent: number;
  /** 10%-marks crossed by the Goal share — ≥2 is a multi-Milestone leap
   * worth one celebration line (the Milestones themselves fire from the
   * feed balance once the money actually moves). */
  milestonesCrossed: number;
}

/** Same floor-percent read as the Goals engine, applied before/after. */
export function goalImpact(
  progressCents: number,
  targetCents: number,
  addCents: number
): GoalImpact | null {
  if (targetCents <= 0) return null;
  const pct = (cents: number) =>
    Math.min(100, Math.floor((Math.max(0, cents) / targetCents) * 100));
  const beforePercent = pct(progressCents);
  const afterPercent = pct(progressCents + addCents);
  return {
    beforePercent,
    afterPercent,
    milestonesCrossed:
      Math.floor(afterPercent / 10) - Math.floor(beforePercent / 10),
  };
}
