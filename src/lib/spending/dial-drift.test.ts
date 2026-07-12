import { describe, expect, it } from "vitest";
import {
  computeDialShares,
  selectDriftCallout,
  DIAL_DRIFT_MIN_TRANSACTIONS,
  type GuiltFreeTransaction,
} from "./dial-drift.ts";

function txn(amountCents: number, moneyDial: string | null): GuiltFreeTransaction {
  return { amountCents, moneyDial };
}

// Nine dials, all importance 5 -> every dial's expected share is 1/9.
const FLAT_IMPORTANCE: Record<string, number> = {};

describe("computeDialShares", () => {
  it("reconciles exactly with the Guilt-Free bucket actual", () => {
    const breakdown = computeDialShares([
      txn(-6000, "FOOD_DINING"),
      txn(-3000, "TRAVEL"),
      txn(-1000, null), // guilt-free spend not yet assigned a dial
      txn(2500, "FOOD_DINING"), // refund: money-in never counts as spending
    ]);

    expect(breakdown.totalCents).toBe(10_000);
    const shareSum = breakdown.shares.reduce((sum, s) => sum + s.actualCents, 0);
    expect(shareSum).toBe(breakdown.totalCents);

    const food = breakdown.shares.find((s) => s.dial === "FOOD_DINING");
    expect(food?.sharePercent).toBeCloseTo(60);
    const noDial = breakdown.shares.find((s) => s.dial === null);
    expect(noDial?.actualCents).toBe(1000);
  });

  it("lists every Money Dial even with zero spend, and counts dialed transactions", () => {
    const breakdown = computeDialShares([txn(-500, "TRAVEL"), txn(-500, null)]);
    // 9 dials + the no-dial row
    expect(breakdown.shares).toHaveLength(10);
    expect(breakdown.dialedTransactionCount).toBe(1);
    expect(breakdown.shares.filter((s) => s.dial !== null)).toHaveLength(9);
  });

  it("handles an empty month without NaN", () => {
    const breakdown = computeDialShares([]);
    expect(breakdown.totalCents).toBe(0);
    for (const share of breakdown.shares) {
      expect(Number.isNaN(share.sharePercent)).toBe(false);
    }
  });
});

describe("selectDriftCallout", () => {
  function monthOfTransactions(): GuiltFreeTransaction[] {
    // 6 dialed transactions: CONVENIENCE dominates at 70% of dialed spend.
    return [
      txn(-35_000, "CONVENIENCE"),
      txn(-35_000, "CONVENIENCE"),
      txn(-10_000, "TRAVEL"),
      txn(-10_000, "FOOD_DINING"),
      txn(-5_000, "EXPERIENCES"),
      txn(-5_000, "HEALTH_FITNESS"),
    ];
  }

  it("names the single largest importance-vs-share mismatch, above direction", () => {
    const callout = selectDriftCallout(
      computeDialShares(monthOfTransactions()),
      { ...FLAT_IMPORTANCE, CONVENIENCE: 2, TRAVEL: 9 }
    );

    expect(callout).not.toBeNull();
    expect(callout?.dial).toBe("CONVENIENCE");
    expect(callout?.direction).toBe("above");
    // Honesty Rule: fixable framing, no shame vocabulary.
    expect(callout?.sentence).toContain("fixable");
    expect(callout?.sentence.toLowerCase()).not.toContain("overspend");
    // One concrete next action, pointed at the highest-importance dial.
    expect(callout?.nextAction).toContain("Travel & Adventure");
  });

  it("uses the below direction when a loved dial is starved", () => {
    const callout = selectDriftCallout(
      computeDialShares([
        txn(-20_000, "CONVENIENCE"),
        txn(-20_000, "FOOD_DINING"),
        txn(-20_000, "TECHNOLOGY"),
        txn(-20_000, "FASHION"),
        txn(-20_000, "EXPERIENCES"),
      ]),
      { ...FLAT_IMPORTANCE, TRAVEL: 10 }
    );

    expect(callout?.dial).toBe("TRAVEL");
    expect(callout?.direction).toBe("below");
    expect(callout?.actualSharePercent).toBe(0);
    expect(callout?.nextAction).toContain("Travel & Adventure");
  });

  it("is suppressed when the month is too thin to read honestly", () => {
    const thin = computeDialShares([
      txn(-10_000, "CONVENIENCE"),
      txn(-10_000, "TRAVEL"),
    ]);
    expect(thin.dialedTransactionCount).toBeLessThan(DIAL_DRIFT_MIN_TRANSACTIONS);
    expect(selectDriftCallout(thin, FLAT_IMPORTANCE)).toBeNull();
  });

  it("respects a configurable minimum", () => {
    const breakdown = computeDialShares([
      txn(-10_000, "CONVENIENCE"),
      txn(-10_000, "TRAVEL"),
    ]);
    expect(selectDriftCallout(breakdown, FLAT_IMPORTANCE, 2)).not.toBeNull();
    expect(selectDriftCallout(breakdown, FLAT_IMPORTANCE, 3)).toBeNull();
  });

  it("returns null when nothing carries a dial yet", () => {
    const breakdown = computeDialShares([
      txn(-10_000, null),
      txn(-10_000, null),
      txn(-10_000, null),
      txn(-10_000, null),
      txn(-10_000, null),
    ]);
    expect(selectDriftCallout(breakdown, FLAT_IMPORTANCE)).toBeNull();
  });
});
