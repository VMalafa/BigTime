import { describe, expect, it } from "vitest";
import type { BonusEntry } from "@/lib/store/flow-store";
import {
  DEFAULT_BONUS_TAX_RATE,
  calculateAnnualNet,
  calculateBonusNet,
  calculateMonthlyEquivalent,
  frequencyPerYear,
} from "@/lib/calculations/bonus-tax";

function bonus(overrides: Partial<BonusEntry> = {}): BonusEntry {
  return {
    id: "b1",
    name: "Bonus",
    grossAmount: 10000,
    estimatedTaxRate: DEFAULT_BONUS_TAX_RATE,
    frequency: "ANNUAL",
    ...overrides,
  };
}

describe("calculateBonusNet", () => {
  it("applies the default 35% withholding rate", () => {
    expect(calculateBonusNet(1000)).toBeCloseTo(650);
  });

  it("applies an explicit rate", () => {
    expect(calculateBonusNet(1000, 20)).toBeCloseTo(800);
  });

  it("returns 0 for non-positive or non-finite gross amounts", () => {
    expect(calculateBonusNet(0)).toBe(0);
    expect(calculateBonusNet(-500)).toBe(0);
    expect(calculateBonusNet(Number.NaN)).toBe(0);
    expect(calculateBonusNet(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("clamps the rate to the 0-100 range", () => {
    expect(calculateBonusNet(1000, -10)).toBeCloseTo(1000);
    expect(calculateBonusNet(1000, 150)).toBeCloseTo(0);
  });
});

describe("frequencyPerYear", () => {
  it("maps each frequency to its occurrences per year", () => {
    expect(frequencyPerYear("ONE_TIME")).toBe(1);
    expect(frequencyPerYear("QUARTERLY")).toBe(4);
    expect(frequencyPerYear("SEMI_ANNUAL")).toBe(2);
    expect(frequencyPerYear("ANNUAL")).toBe(1);
  });
});

describe("calculateAnnualNet / calculateMonthlyEquivalent", () => {
  it("annualizes a quarterly bonus", () => {
    const b = bonus({ grossAmount: 1000, estimatedTaxRate: 35, frequency: "QUARTERLY" });
    expect(calculateAnnualNet(b)).toBeCloseTo(2600);
  });

  it("monthly equivalent is annual net divided by 12", () => {
    const b = bonus({ grossAmount: 1200, estimatedTaxRate: 0, frequency: "ANNUAL" });
    expect(calculateMonthlyEquivalent(b)).toBeCloseTo(100);
  });
});
