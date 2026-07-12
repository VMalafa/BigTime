import { describe, expect, it } from "vitest";
import {
  deriveMerchantPattern,
  matchesMerchantPattern,
  resolveCorrection,
} from "./corrections.ts";
import { categorizeByRule } from "./deterministic.ts";

describe("resolveCorrection", () => {
  it("normalizes a bucket reassignment with its second level", () => {
    expect(
      resolveCorrection({ cspBucket: "GUILT_FREE", moneyDial: "FOOD_DINING" })
    ).toEqual({
      kind: "categorize",
      cspBucket: "GUILT_FREE",
      moneyDial: "FOOD_DINING",
      fixedCostCategory: null,
    });
    expect(
      resolveCorrection({ cspBucket: "FIXED_COSTS", fixedCostCategory: "HOUSING" })
    ).toEqual({
      kind: "categorize",
      cspBucket: "FIXED_COSTS",
      moneyDial: null,
      fixedCostCategory: "HOUSING",
    });
  });

  it("drops a second level that does not belong to the bucket", () => {
    const result = resolveCorrection({
      cspBucket: "SAVINGS",
      moneyDial: "TRAVEL",
      fixedCostCategory: "HOUSING",
    });
    expect(result).toEqual({
      kind: "categorize",
      cspBucket: "SAVINGS",
      moneyDial: null,
      fixedCostCategory: null,
    });
  });

  it("mark-as-Transfer wins and needs no bucket", () => {
    expect(resolveCorrection({ markAsTransfer: true })).toEqual({
      kind: "mark-transfer",
    });
  });

  it("rejects missing or invalid buckets — never back to UNCATEGORIZED", () => {
    expect(resolveCorrection({}).kind).toBe("invalid");
    expect(resolveCorrection({ cspBucket: "UNCATEGORIZED" }).kind).toBe("invalid");
    expect(resolveCorrection({ cspBucket: "NOT_A_BUCKET" }).kind).toBe("invalid");
  });
});

describe("merchant patterns", () => {
  it("derives a store-number-free pattern from a description", () => {
    expect(deriveMerchantPattern("SQ *COFFEE 4821")).toBe("SQ COFFEE");
  });

  it("matches other transactions of the same merchant", () => {
    expect(matchesMerchantPattern("SQ *COFFEE 77 SEATTLE", "SQ COFFEE")).toBe(true);
    expect(matchesMerchantPattern("SHELL OIL 123", "SQ COFFEE")).toBe(false);
    expect(matchesMerchantPattern("ANYTHING", "")).toBe(false);
  });
});

describe("a Correction becomes a rule the next sync applies", () => {
  it("categorizes a brand-new transaction from the corrected merchant", () => {
    // The household corrected "SQ *COFFEE 4821" to Guilt-Free / Food & Dining;
    // the action stored this rule:
    const rule = {
      merchantPattern: deriveMerchantPattern("SQ *COFFEE 4821"),
      cspBucket: "GUILT_FREE" as const,
      moneyDial: "FOOD_DINING",
      fixedCostCategory: null,
    };

    // Next sync sees the same merchant at a different store number.
    const next = categorizeByRule(
      {
        id: "new",
        linkedAccountId: "acct",
        amountCents: -650,
        postedAt: new Date("2026-08-01T00:00:00Z"),
        description: "SQ *COFFEE 9012 PORTLAND",
        cspBucket: "UNCATEGORIZED",
        isTransfer: false,
        transferPairId: null,
      },
      [rule]
    );

    expect(next).toEqual({
      cspBucket: "GUILT_FREE",
      moneyDial: "FOOD_DINING",
      fixedCostCategory: null,
      source: "RULE",
    });
  });
});
