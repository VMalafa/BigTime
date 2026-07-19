// Windfall detection (#89): a non-recurring deposit that matches neither
// partner's paycheck pattern (the recurring engine's word) and is at least
// half the typical paycheck raises a Bonus Moment; smaller ones flow
// through normal income categorization silently. Pure predicate — the
// action layer owns idempotent persistence (unique feedTransactionId).

import { matchesMerchantPattern } from "../categorization/corrections.ts";
import { normalizeMerchant } from "../categorization/deterministic.ts";
import type { RecurringPattern } from "../recurring/pattern-engine.ts";

/** Ratified in #63: a real windfall is ≥ half a typical paycheck. */
export const BONUS_MIN_PAYCHECK_RATIO = 0.5;

export interface BonusDepositInput {
  id: string;
  postedAt: Date;
  amountCents: number;
  description: string;
  isTransfer: boolean;
}

export interface BonusCandidate {
  feedTransactionId: string;
  postedAt: Date;
  amountCents: number;
  description: string;
}

/** The household's typical paycheck: the median confirmed-stream deposit. */
export function typicalPaycheckCents(paycheckAmountsCents: number[]): number {
  if (paycheckAmountsCents.length === 0) return 0;
  const sorted = [...paycheckAmountsCents].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export interface BonusDetectInput {
  /** Positive, feed-reported deposits in the lookback window. */
  deposits: BonusDepositInput[];
  /** CONFIRMED income-stream merchant patterns — paychecks, never windfalls. */
  confirmedStreamPatterns: string[];
  /** The recurring engine's read of the same window: any deposit belonging
   * to a detected deposit pattern is rhythm, not windfall — including a
   * second paycheck stream the household hasn't confirmed yet. */
  recurringDepositPatterns: RecurringPattern[];
  typicalPaycheckCents: number;
}

/**
 * Every deposit that reads as a real windfall, oldest first. No typical
 * paycheck (manual fuel, no confirmed stream) means no detection — the
 * threshold would be meaningless.
 */
export function detectBonusDeposits(input: BonusDetectInput): BonusCandidate[] {
  if (input.typicalPaycheckCents <= 0) return [];
  const thresholdCents = Math.ceil(
    input.typicalPaycheckCents * BONUS_MIN_PAYCHECK_RATIO
  );

  const recurringIds = new Set(
    input.recurringDepositPatterns
      .filter((p) => p.direction === "deposit")
      .flatMap((p) => p.transactionIds)
  );
  const streamNeedles = input.confirmedStreamPatterns.map((p) =>
    normalizeMerchant(p)
  );

  return input.deposits
    .filter(
      (d) =>
        !d.isTransfer &&
        d.amountCents >= thresholdCents &&
        !recurringIds.has(d.id) &&
        !streamNeedles.some((needle) =>
          matchesMerchantPattern(d.description, needle)
        )
    )
    .map((d) => ({
      feedTransactionId: d.id,
      postedAt: d.postedAt,
      amountCents: d.amountCents,
      description: d.description,
    }))
    .sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
}
