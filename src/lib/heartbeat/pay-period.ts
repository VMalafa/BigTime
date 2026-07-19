// The household heartbeat (CONTEXT.md): Pay Periods bounded by detected
// paycheck deposits (either partner's), Earmarks reserving fixed costs due
// inside the current period, and Safe-to-Spend — the single leading number.
// Pure module; reflective views stay on calendar months elsewhere.

import { matchesMerchantPattern } from "../categorization/corrections.ts";
import { normalizeMerchant } from "../categorization/deterministic.ts";
import type { RecurringPattern } from "../recurring/pattern-engine.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DepositInput {
  postedAt: Date;
  amountCents: number;
  description: string;
}

/**
 * Paycheck deposits are deposits matching a CONFIRMED income stream's
 * merchant pattern. Everything else — bonuses, reimbursements, transfers —
 * never bounds a Pay Period and never inflates Safe-to-Spend.
 */
export function filterPaycheckDeposits(
  deposits: DepositInput[],
  confirmedStreamPatterns: string[]
): { deposit: DepositInput; streamPattern: string }[] {
  const results: { deposit: DepositInput; streamPattern: string }[] = [];
  for (const deposit of deposits) {
    if (deposit.amountCents <= 0) continue;
    const stream = confirmedStreamPatterns.find((pattern) =>
      matchesMerchantPattern(deposit.description, normalizeMerchant(pattern))
    );
    if (stream) results.push({ deposit, streamPattern: stream });
  }
  return results;
}

export interface PayPeriod {
  start: Date;
  endExclusive: Date;
  /** True when the end is a projection — the next paycheck hasn't landed. */
  projectedEnd: boolean;
  /** The paycheck(s) that opened this period (same-day deposits merged). */
  paycheckCents: number;
}

function dayFloor(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * The current Pay Period: the span between the most recent paycheck deposit
 * (either partner's) and the next. Interleaved schedules naturally produce
 * variable-length periods because every stream's deposit is a boundary.
 * When the next paycheck hasn't landed yet, the end is projected from each
 * stream's own cadence (earliest expected next deposit).
 */
export function deriveCurrentPayPeriod(
  paychecks: { deposit: DepositInput; streamPattern: string }[],
  now: Date
): PayPeriod | null {
  if (paychecks.length === 0) return null;

  // Boundaries: unique deposit days across all streams, merged same-day.
  const byDay = new Map<number, number>();
  for (const { deposit } of paychecks) {
    const day = dayFloor(deposit.postedAt);
    byDay.set(day, (byDay.get(day) ?? 0) + deposit.amountCents);
  }
  const boundaryDays = [...byDay.keys()].sort((a, b) => a - b);

  const nowDay = dayFloor(now);
  const startDay = [...boundaryDays].reverse().find((d) => d <= nowDay);
  if (startDay === undefined) return null;

  const nextActualDay = boundaryDays.find((d) => d > startDay);
  let endDay: number;
  let projectedEnd = false;
  if (nextActualDay !== undefined) {
    endDay = nextActualDay;
  } else {
    projectedEnd = true;
    // Project per stream: last deposit day + that stream's median gap.
    const projections: number[] = [];
    const streams = new Map<string, number[]>();
    for (const { deposit, streamPattern } of paychecks) {
      const days = streams.get(streamPattern) ?? [];
      days.push(dayFloor(deposit.postedAt));
      streams.set(streamPattern, days);
    }
    for (const days of streams.values()) {
      const sorted = [...new Set(days)].sort((a, b) => a - b);
      if (sorted.length < 2) continue;
      const gaps = sorted.slice(1).map((d, i) => d - sorted[i]);
      const projection = sorted[sorted.length - 1] + Math.round(median(gaps));
      if (projection > startDay) projections.push(projection);
    }
    endDay =
      projections.length > 0
        ? Math.min(...projections)
        : startDay + 14; // lone single-occurrence stream: assume biweekly
  }

  return {
    start: new Date(startDay * DAY_MS),
    endExclusive: new Date(endDay * DAY_MS),
    projectedEnd,
    paycheckCents: byDay.get(startDay) ?? 0,
  };
}

export interface LineItemInput {
  name: string;
  monthlyAmountCents: number;
}

export interface Earmark {
  name: string;
  /** The real bill amount (from the detected charge pattern). */
  amountCents: number;
  dueDate: Date;
}

export interface EarmarkResult {
  earmarks: Earmark[];
  /** Line items with no detected due date — handled explicitly, never
   * silently reserved or silently ignored. */
  undated: { name: string; monthlyAmountCents: number }[];
}

const CADENCE_GAP_DAYS: Record<string, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  SEMI_MONTHLY: 15,
  MONTHLY: 30,
  QUARTERLY: 91,
  SEMI_ANNUAL: 183,
  ANNUAL: 365,
};

/**
 * Earmarks: fixed costs whose due date falls inside the Pay Period. Due
 * dates come from each line item's matching recurring charge pattern (last
 * seen + cadence, projected forward into the period). Items without a
 * matching pattern are returned as `undated`.
 */
export function deriveEarmarks(
  lineItems: LineItemInput[],
  chargePatterns: RecurringPattern[],
  period: PayPeriod
): EarmarkResult {
  const earmarks: Earmark[] = [];
  const undated: EarmarkResult["undated"] = [];

  for (const item of lineItems) {
    const needle = normalizeMerchant(item.name);
    const pattern =
      needle.length >= 3
        ? chargePatterns.find(
            (p) =>
              p.direction === "charge" &&
              (p.merchantPattern.includes(needle) ||
                needle.includes(p.merchantPattern))
          )
        : undefined;

    if (!pattern) {
      undated.push({ name: item.name, monthlyAmountCents: item.monthlyAmountCents });
      continue;
    }

    const gapDays = CADENCE_GAP_DAYS[pattern.cadence] ?? 30;
    let dueDay = dayFloor(pattern.lastSeen);
    const startDay = dayFloor(period.start);
    const endDay = dayFloor(period.endExclusive);
    while (dueDay < startDay) dueDay += gapDays;

    if (dueDay >= startDay && dueDay < endDay) {
      earmarks.push({
        name: item.name,
        amountCents: pattern.typicalAmountCents,
        dueDate: new Date(dueDay * DAY_MS),
      });
    }
  }

  earmarks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return { earmarks, undated };
}

export interface SafeToSpend {
  /** The single leading number, in cents. Can be negative — that's honest. */
  safeToSpendCents: number;
  paycheckCents: number;
  earmarkedCents: number;
  plannedSavingsInvestmentsCents: number;
}

/**
 * Safe-to-Spend: the current Pay Period's paycheck minus its Earmarks and
 * the planned savings/investments share. What's genuinely free until the
 * next check.
 */
export function computeSafeToSpend(
  period: PayPeriod,
  earmarks: Earmark[],
  plan: { savingsPercent: number; investmentsPercent: number } | null
): SafeToSpend {
  const earmarkedCents = earmarks.reduce((sum, e) => sum + e.amountCents, 0);
  const plannedShare = plan
    ? (plan.savingsPercent + plan.investmentsPercent) / 100
    : 0;
  const plannedSavingsInvestmentsCents = Math.round(
    period.paycheckCents * plannedShare
  );
  return {
    safeToSpendCents:
      period.paycheckCents - earmarkedCents - plannedSavingsInvestmentsCents,
    paycheckCents: period.paycheckCents,
    earmarkedCents,
    plannedSavingsInvestmentsCents,
  };
}
