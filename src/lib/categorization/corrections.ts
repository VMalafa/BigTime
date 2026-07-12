// Pure logic for Corrections (CONTEXT.md): a household member reassigning a
// Transaction's Categorization. A Correction is never a one-off — it becomes
// a standing CategoryRule for that merchant, so the same mistake is never
// made twice. This module stays free of Prisma/I-O so it is unit-testable.

import { normalizeMerchant, type CspBucket } from "./deterministic.ts";

/** Buckets a human can correct a transaction to (never back to UNCATEGORIZED). */
export const CORRECTABLE_BUCKETS = [
  "FIXED_COSTS",
  "SAVINGS",
  "INVESTMENTS",
  "GUILT_FREE",
] as const;

export type CorrectableBucket = (typeof CORRECTABLE_BUCKETS)[number];

export interface CorrectionInput {
  /** Reassign to this CSP bucket… */
  cspBucket?: string | null;
  /** …with a Money Dial (only meaningful within GUILT_FREE)… */
  moneyDial?: string | null;
  /** …or a fixed-cost category (only meaningful within FIXED_COSTS). */
  fixedCostCategory?: string | null;
  /** Or: "this is a Transfer between my own accounts". */
  markAsTransfer?: boolean;
}

export type ResolvedCorrection =
  | {
      kind: "categorize";
      cspBucket: CorrectableBucket;
      moneyDial: string | null;
      fixedCostCategory: string | null;
    }
  | { kind: "mark-transfer" }
  | { kind: "invalid"; reason: string };

/**
 * Validates and normalizes a Correction: exactly one of "mark as Transfer"
 * or a bucket reassignment, with the second level only where it belongs.
 */
export function resolveCorrection(input: CorrectionInput): ResolvedCorrection {
  if (input.markAsTransfer) {
    return { kind: "mark-transfer" };
  }
  const bucket = input.cspBucket as CorrectableBucket | null | undefined;
  if (!bucket || !CORRECTABLE_BUCKETS.includes(bucket)) {
    return {
      kind: "invalid",
      reason: "Pick one of the four CSP buckets or mark it as a Transfer.",
    };
  }
  return {
    kind: "categorize",
    cspBucket: bucket,
    moneyDial: bucket === "GUILT_FREE" ? (input.moneyDial ?? null) : null,
    fixedCostCategory:
      bucket === "FIXED_COSTS" ? (input.fixedCostCategory ?? null) : null,
  };
}

/**
 * The standing rule pattern for a merchant, derived from a corrected
 * transaction's description. Normalization collapses store numbers and
 * punctuation, so `SQ *COFFEE 4821` and `SQ *COFFEE 77` share one rule.
 */
export function deriveMerchantPattern(description: string): string {
  return normalizeMerchant(description);
}

/** Whether an existing transaction belongs to a rule's merchant. */
export function matchesMerchantPattern(
  description: string,
  merchantPattern: string
): boolean {
  if (merchantPattern.length < 2) return false;
  return normalizeMerchant(description).includes(merchantPattern);
}

/** Rule cspBucket type guard for reuse at the persistence boundary. */
export function isCspBucket(value: string): value is CspBucket {
  return [
    "UNCATEGORIZED",
    "FIXED_COSTS",
    "SAVINGS",
    "INVESTMENTS",
    "GUILT_FREE",
  ].includes(value);
}
