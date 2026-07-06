import type { BonusEntry, BonusFrequency } from "@/lib/store/flow-store";

/**
 * Default combined effective withholding rate for supplemental/bonus pay.
 *
 * Breakdown:
 *  - Federal supplemental withholding: 22% (flat, for bonuses ≤ $1M)
 *  - FICA (Social Security + Medicare): 7.65%
 *  - Average state supplemental: ~5%
 *
 * We round the combined ~34.65% up slightly to a conservative 35% so the
 * "net bonus" number users see is unlikely to over-promise take-home pay.
 */
export const DEFAULT_BONUS_TAX_RATE = 35;

/**
 * Converts a gross bonus amount to an estimated net (take-home) amount after
 * applying a withholding rate. Use this for planning, not tax filing.
 */
export function calculateBonusNet(
  grossAmount: number,
  taxRate: number = DEFAULT_BONUS_TAX_RATE
): number {
  if (!isFinite(grossAmount) || grossAmount <= 0) return 0;
  const rate = Math.max(0, Math.min(100, taxRate)) / 100;
  return grossAmount * (1 - rate);
}

/**
 * Annualized net value for a bonus, accounting for how often it recurs.
 */
export function calculateAnnualNet(bonus: BonusEntry): number {
  const net = calculateBonusNet(bonus.grossAmount, bonus.estimatedTaxRate);
  return net * frequencyPerYear(bonus.frequency);
}

/**
 * Monthly equivalent for budget smoothing (annual net / 12).
 */
export function calculateMonthlyEquivalent(bonus: BonusEntry): number {
  return calculateAnnualNet(bonus) / 12;
}

export function frequencyPerYear(frequency: BonusFrequency): number {
  switch (frequency) {
    case "ONE_TIME":
      return 1;
    case "QUARTERLY":
      return 4;
    case "SEMI_ANNUAL":
      return 2;
    case "ANNUAL":
      return 1;
  }
}

export const FREQUENCY_LABELS: Record<BonusFrequency, string> = {
  ONE_TIME: "One-time",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-annual",
  ANNUAL: "Annual",
};
