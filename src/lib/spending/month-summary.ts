// Pure month math + plan-vs-actual aggregation for the Spending page.
// "Where is the money going" runs on calendar months (ADR-0003: Pay Periods
// are reserved for the live heartbeat). Transfers are excluded from every
// number — spending, income, and the uncategorized count alike.

export type SpendingBucket =
  | "FIXED_COSTS"
  | "SAVINGS"
  | "INVESTMENTS"
  | "GUILT_FREE";

export const SPENDING_BUCKETS: readonly SpendingBucket[] = [
  "FIXED_COSTS",
  "SAVINGS",
  "INVESTMENTS",
  "GUILT_FREE",
];

export const BUCKET_LABELS: Record<SpendingBucket, string> = {
  FIXED_COSTS: "Fixed Costs",
  SAVINGS: "Savings",
  INVESTMENTS: "Investments",
  GUILT_FREE: "Guilt-Free Spending",
};

export interface MonthTransaction {
  amountCents: number; // signed; negative = money out
  cspBucket: string;
  isTransfer: boolean;
}

export interface PlanPercents {
  fixedCostsPercent: number;
  savingsPercent: number;
  investmentsPercent: number;
  guiltFreePercent: number;
}

export interface BucketSummary {
  bucket: SpendingBucket;
  planPercent: number;
  actualCents: number;
  /** Actual money-out as a share of the month's income, 0 when income is 0. */
  actualPercent: number;
}

export interface MonthSummary {
  /** The income denominator in cents and where it came from. */
  incomeCents: number;
  incomeSource: "feed" | "plan" | "none";
  buckets: BucketSummary[];
  /** Money-out transactions still UNCATEGORIZED (Transfers excluded). */
  uncategorizedCount: number;
  uncategorizedCents: number;
}

/** "2026-07" -> UTC month boundaries [start, endExclusive). */
export function monthRange(monthKey: string): {
  start: Date;
  endExclusive: Date;
} {
  const { year, month } = parseMonthKey(monthKey);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    endExclusive: new Date(Date.UTC(year, month, 1)),
  };
}

export function parseMonthKey(monthKey: string): {
  year: number;
  month: number;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error(`Invalid month key: ${monthKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid month key: ${monthKey}`);
  return { year, month };
}

export function isValidMonthKey(monthKey: string): boolean {
  try {
    parseMonthKey(monthKey);
    return true;
  } catch {
    return false;
  }
}

export function monthKeyFor(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Shift a month key by whole months (negative = past). */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  return monthKeyFor(new Date(Date.UTC(year, month - 1 + delta, 1)));
}

/** "2026-07" -> "July 2026" for headings. */
export function monthKeyLabel(monthKey: string): string {
  const { start } = monthRange(monthKey);
  return start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Plan-vs-actual for one calendar month. The income denominator is the
 * month's feed income (deposits, Transfers excluded); when the feed saw no
 * income that month, the household's planned monthly income is used instead
 * so the bars stay meaningful.
 */
export function summarizeMonth(
  transactions: MonthTransaction[],
  plan: PlanPercents | null,
  plannedIncomeCents: number
): MonthSummary {
  const real = transactions.filter((t) => !t.isTransfer);

  const feedIncomeCents = real
    .filter((t) => t.amountCents > 0)
    .reduce((sum, t) => sum + t.amountCents, 0);
  const incomeCents = feedIncomeCents > 0 ? feedIncomeCents : plannedIncomeCents;
  const incomeSource: MonthSummary["incomeSource"] =
    feedIncomeCents > 0 ? "feed" : plannedIncomeCents > 0 ? "plan" : "none";

  const outByBucket = new Map<string, number>();
  for (const t of real) {
    if (t.amountCents >= 0) continue;
    outByBucket.set(
      t.cspBucket,
      (outByBucket.get(t.cspBucket) ?? 0) + Math.abs(t.amountCents)
    );
  }

  const planPercents: Record<SpendingBucket, number> = {
    FIXED_COSTS: plan?.fixedCostsPercent ?? 0,
    SAVINGS: plan?.savingsPercent ?? 0,
    INVESTMENTS: plan?.investmentsPercent ?? 0,
    GUILT_FREE: plan?.guiltFreePercent ?? 0,
  };

  const buckets: BucketSummary[] = SPENDING_BUCKETS.map((bucket) => {
    const actualCents = outByBucket.get(bucket) ?? 0;
    return {
      bucket,
      planPercent: planPercents[bucket],
      actualCents,
      actualPercent: incomeCents > 0 ? (actualCents / incomeCents) * 100 : 0,
    };
  });

  const uncategorized = real.filter(
    (t) => t.amountCents < 0 && t.cspBucket === "UNCATEGORIZED"
  );

  return {
    incomeCents,
    incomeSource,
    buckets,
    uncategorizedCount: uncategorized.length,
    uncategorizedCents: uncategorized.reduce(
      (sum, t) => sum + Math.abs(t.amountCents),
      0
    ),
  };
}
