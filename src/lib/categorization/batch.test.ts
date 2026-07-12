import { describe, expect, it } from "vitest";
import {
  groupQueueByMerchant,
  planBatchApplication,
  validateBatchEntries,
  type BatchEntry,
} from "./batch.ts";

function entry(overrides: Partial<BatchEntry> = {}): BatchEntry {
  return {
    merchantPattern: "SQ COFFEE",
    cspBucket: "GUILT_FREE",
    moneyDial: "FOOD_DINING",
    fixedCostCategory: null,
    ...overrides,
  };
}

describe("validateBatchEntries", () => {
  it("accepts a well-formed mapping and normalizes patterns", () => {
    const { entries, errors } = validateBatchEntries({
      entries: [
        { merchantPattern: "SQ *Coffee 4821", cspBucket: "GUILT_FREE", moneyDial: "FOOD_DINING" },
        { merchantPattern: "GEICO", cspBucket: "FIXED_COSTS", fixedCostCategory: "INSURANCE" },
        { merchantPattern: "Ally Savings", cspBucket: "SAVINGS" },
      ],
    });
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      { merchantPattern: "SQ COFFEE", cspBucket: "GUILT_FREE", moneyDial: "FOOD_DINING", fixedCostCategory: null },
      { merchantPattern: "GEICO", cspBucket: "FIXED_COSTS", moneyDial: null, fixedCostCategory: "INSURANCE" },
      { merchantPattern: "ALLY SAVINGS", cspBucket: "SAVINGS", moneyDial: null, fixedCostCategory: null },
    ]);
  });

  it("rejects taxonomy violations with reasons", () => {
    const { entries, errors } = validateBatchEntries([
      { merchantPattern: "X1", cspBucket: "GUILT_FREE" }, // pattern normalizes to "X" — too short
      { merchantPattern: "SHELL", cspBucket: "PETROL" }, // invented bucket
      { merchantPattern: "SPOTIFY", cspBucket: "GUILT_FREE", moneyDial: "MUSIC" }, // invented dial
      { merchantPattern: "RENT CO", cspBucket: "FIXED_COSTS", fixedCostCategory: "RENT" }, // invented category
      { merchantPattern: "UNCLEAR", cspBucket: "UNCATEGORIZED" }, // not a target bucket
    ]);
    expect(entries).toEqual([]);
    expect(errors).toHaveLength(5);
  });

  it("rejects duplicate patterns and non-array input", () => {
    expect(
      validateBatchEntries([entry(), entry()]).errors[0]
    ).toContain("duplicate");
    expect(validateBatchEntries("nope").errors[0]).toContain("array");
  });
});

describe("planBatchApplication", () => {
  const queue = [
    { id: "t1", description: "SQ *COFFEE 4821" },
    { id: "t2", description: "SQ *COFFEE 77 PDX" },
    { id: "t3", description: "TOTALLY UNKNOWN LLC" },
  ];

  it("labels matching queue transactions and leaves the rest honestly unmatched", () => {
    const plan = planBatchApplication(queue, [entry()], []);
    expect(plan.labelUpdates.map((u) => u.transactionId)).toEqual(["t1", "t2"]);
    expect(plan.unmatchedTransactionIds).toEqual(["t3"]);
    expect(plan.ruleUpserts).toHaveLength(1);
  });

  it("never overwrites Correction-sourced rules", () => {
    const plan = planBatchApplication(
      queue,
      [entry()],
      [{ merchantPattern: "SQ COFFEE", source: "CORRECTION" }]
    );
    expect(plan.ruleUpserts).toEqual([]);
    expect(plan.skippedCorrectionPatterns).toEqual(["SQ COFFEE"]);
    // Without the rule, its transactions are not labeled either.
    expect(plan.labelUpdates).toEqual([]);
    expect(plan.unmatchedTransactionIds).toEqual(["t1", "t2", "t3"]);
  });

  it("re-running with an empty queue is a no-op", () => {
    const plan = planBatchApplication([], [entry()], []);
    expect(plan.labelUpdates).toEqual([]);
    expect(plan.unmatchedTransactionIds).toEqual([]);
  });

  it("existing BATCH rules may be refreshed", () => {
    const plan = planBatchApplication(
      queue,
      [entry()],
      [{ merchantPattern: "SQ COFFEE", source: "BATCH" }]
    );
    expect(plan.ruleUpserts).toHaveLength(1);
  });
});

describe("groupQueueByMerchant", () => {
  it("groups by normalized pattern with counts, totals, and samples", () => {
    const groups = groupQueueByMerchant([
      { id: "a", description: "SQ *COFFEE 4821", amountCents: -650 },
      { id: "b", description: "SQ *COFFEE 77", amountCents: -725 },
      { id: "c", description: "SHELL OIL 5", amountCents: -4000 },
    ]);
    expect(groups[0]).toEqual({
      pattern: "SHELL OIL",
      count: 1,
      totalCents: 4000,
      samples: ["SHELL OIL 5"],
    });
    expect(groups[1].pattern).toBe("SQ COFFEE");
    expect(groups[1].count).toBe(2);
    expect(groups[1].totalCents).toBe(1375);
  });
});
