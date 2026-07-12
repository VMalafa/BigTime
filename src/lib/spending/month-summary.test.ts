import { describe, expect, it } from "vitest";
import {
  isValidMonthKey,
  monthKeyLabel,
  monthRange,
  shiftMonthKey,
  summarizeMonth,
  type MonthTransaction,
} from "./month-summary.ts";

const PLAN = {
  fixedCostsPercent: 50,
  savingsPercent: 10,
  investmentsPercent: 10,
  guiltFreePercent: 30,
};

function txn(overrides: Partial<MonthTransaction> = {}): MonthTransaction {
  return {
    amountCents: -1000,
    cspBucket: "UNCATEGORIZED",
    isTransfer: false,
    ...overrides,
  };
}

describe("month keys and boundaries", () => {
  it("computes UTC month boundaries, end exclusive", () => {
    const { start, endExclusive } = monthRange("2026-07");
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("handles December -> January rollover", () => {
    const { endExclusive } = monthRange("2026-12");
    expect(endExclusive.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("validates month keys", () => {
    expect(isValidMonthKey("2026-07")).toBe(true);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("2026-7")).toBe(false);
    expect(isValidMonthKey("garbage")).toBe(false);
  });

  it("labels months for headings", () => {
    expect(monthKeyLabel("2026-07")).toBe("July 2026");
  });
});

describe("summarizeMonth", () => {
  it("computes plan-vs-actual per bucket against feed income", () => {
    const summary = summarizeMonth(
      [
        txn({ amountCents: 600_000 }), // paycheck deposit
        txn({ amountCents: -180_000, cspBucket: "FIXED_COSTS" }),
        txn({ amountCents: -50_000, cspBucket: "SAVINGS" }),
        txn({ amountCents: -30_000, cspBucket: "INVESTMENTS" }),
        txn({ amountCents: -12_000, cspBucket: "GUILT_FREE" }),
      ],
      PLAN,
      0
    );

    expect(summary.incomeCents).toBe(600_000);
    expect(summary.incomeSource).toBe("feed");
    const byBucket = Object.fromEntries(
      summary.buckets.map((b) => [b.bucket, b])
    );
    expect(byBucket.FIXED_COSTS.planPercent).toBe(50);
    expect(byBucket.FIXED_COSTS.actualPercent).toBeCloseTo(30);
    expect(byBucket.SAVINGS.actualPercent).toBeCloseTo(50000 / 6000);
    expect(byBucket.GUILT_FREE.actualCents).toBe(12_000);
  });

  it("excludes Transfers from income, spending, and the uncategorized count", () => {
    const summary = summarizeMonth(
      [
        txn({ amountCents: 600_000 }),
        txn({ amountCents: -40_000, isTransfer: true }), // payment to card
        txn({ amountCents: 40_000, isTransfer: true }), // payment received
        txn({ amountCents: -12_000, cspBucket: "GUILT_FREE" }),
      ],
      PLAN,
      0
    );

    expect(summary.incomeCents).toBe(600_000);
    const guiltFree = summary.buckets.find((b) => b.bucket === "GUILT_FREE");
    expect(guiltFree?.actualCents).toBe(12_000);
    expect(summary.uncategorizedCount).toBe(0);
    expect(
      summary.buckets.reduce((sum, b) => sum + b.actualCents, 0)
    ).toBe(12_000);
  });

  it("counts uncategorized money-out with exact count and total", () => {
    const summary = summarizeMonth(
      [
        txn({ amountCents: -6_000 }),
        txn({ amountCents: -4_500 }),
        txn({ amountCents: 600_000 }), // deposit is not "spending not yet categorized"
      ],
      PLAN,
      0
    );
    expect(summary.uncategorizedCount).toBe(2);
    expect(summary.uncategorizedCents).toBe(10_500);
  });

  it("falls back to planned income when the feed saw none", () => {
    const summary = summarizeMonth(
      [txn({ amountCents: -180_000, cspBucket: "FIXED_COSTS" })],
      PLAN,
      600_000
    );
    expect(summary.incomeCents).toBe(600_000);
    expect(summary.incomeSource).toBe("plan");
    expect(
      summary.buckets.find((b) => b.bucket === "FIXED_COSTS")?.actualPercent
    ).toBeCloseTo(30);
  });

  it("reports zero percents with no income at all, never NaN", () => {
    const summary = summarizeMonth(
      [txn({ amountCents: -180_000, cspBucket: "FIXED_COSTS" })],
      null,
      0
    );
    expect(summary.incomeSource).toBe("none");
    for (const bucket of summary.buckets) {
      expect(bucket.actualPercent).toBe(0);
      expect(Number.isNaN(bucket.actualPercent)).toBe(false);
    }
  });
});
