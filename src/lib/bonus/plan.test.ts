import { describe, expect, it } from "vitest";
import {
  DEFAULT_BONUS_PLAN,
  splitBonus,
  validateBonusPlan,
} from "@/lib/bonus/plan";

describe("validateBonusPlan", () => {
  it("accepts the ratified default", () => {
    expect(validateBonusPlan(DEFAULT_BONUS_PLAN)).toBeNull();
  });

  it("accepts any whole split totalling 100", () => {
    expect(
      validateBonusPlan({ debtPercent: 0, goalPercent: 100, guiltFreePercent: 0 })
    ).toBeNull();
    expect(
      validateBonusPlan({ debtPercent: 34, goalPercent: 33, guiltFreePercent: 33 })
    ).toBeNull();
  });

  it("rejects totals off 100, naming the current total", () => {
    expect(
      validateBonusPlan({ debtPercent: 70, goalPercent: 15, guiltFreePercent: 10 })
    ).toContain("95%");
    expect(
      validateBonusPlan({ debtPercent: 70, goalPercent: 20, guiltFreePercent: 15 })
    ).toContain("105%");
  });

  it("rejects fractions, negatives, and >100 parts", () => {
    expect(
      validateBonusPlan({ debtPercent: 70.5, goalPercent: 14.5, guiltFreePercent: 15 })
    ).not.toBeNull();
    expect(
      validateBonusPlan({ debtPercent: -10, goalPercent: 95, guiltFreePercent: 15 })
    ).not.toBeNull();
    expect(
      validateBonusPlan({ debtPercent: 110, goalPercent: -5, guiltFreePercent: -5 })
    ).not.toBeNull();
  });
});

describe("splitBonus", () => {
  it("applies the default 70/15/15 in real dollars", () => {
    expect(splitBonus(90_000, DEFAULT_BONUS_PLAN)).toEqual({
      debtCents: 63_000,
      goalCents: 13_500,
      guiltFreeCents: 13_500,
    });
  });

  it("always sums exactly to the amount — debt absorbs rounding", () => {
    const split = splitBonus(10_001, DEFAULT_BONUS_PLAN);
    expect(split.debtCents + split.goalCents + split.guiltFreeCents).toBe(
      10_001
    );
  });

  it("never returns a negative debt share at 0% debt", () => {
    const split = splitBonus(101, {
      debtPercent: 0,
      goalPercent: 50,
      guiltFreePercent: 50,
    });
    expect(split.debtCents).toBe(0);
    expect(split.goalCents + split.guiltFreeCents).toBe(101);
  });

  it("handles a 100% single-bucket plan", () => {
    expect(
      splitBonus(50_000, { debtPercent: 100, goalPercent: 0, guiltFreePercent: 0 })
    ).toEqual({ debtCents: 50_000, goalCents: 0, guiltFreeCents: 0 });
  });
});
