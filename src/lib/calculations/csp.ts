import { CSP_RANGES } from "@/lib/constants/csp-ranges";

export interface SpendingPlanData {
  fixedCostsPercent: number;
  savingsPercent: number;
  investmentsPercent: number;
  guiltFreePercent: number;
}

type Percentages = {
  fixedCostsPercent: number;
  savingsPercent: number;
  investmentsPercent: number;
  guiltFreePercent: number;
};

type RangesType = typeof CSP_RANGES;

export function calculateDollarAmounts(
  percentages: Percentages,
  totalIncome: number,
): {
  fixedCosts: number;
  savings: number;
  investments: number;
  guiltFree: number;
} {
  return {
    fixedCosts: Math.round(
      (totalIncome * percentages.fixedCostsPercent) / 100,
    ),
    savings: Math.round((totalIncome * percentages.savingsPercent) / 100),
    investments: Math.round(
      (totalIncome * percentages.investmentsPercent) / 100,
    ),
    guiltFree: Math.round(
      (totalIncome * percentages.guiltFreePercent) / 100,
    ),
  };
}

export function calculateTotal(percentages: Percentages): number {
  return (
    percentages.fixedCostsPercent +
    percentages.savingsPercent +
    percentages.investmentsPercent +
    percentages.guiltFreePercent
  );
}

export function calculateRemaining(percentages: Percentages): number {
  return 100 - calculateTotal(percentages);
}

const BUCKET_KEYS: Array<{
  key: keyof SpendingPlanData;
  rangeKey: keyof RangesType;
}> = [
  { key: "fixedCostsPercent", rangeKey: "fixedCosts" },
  { key: "savingsPercent", rangeKey: "savings" },
  { key: "investmentsPercent", rangeKey: "investments" },
  { key: "guiltFreePercent", rangeKey: "guiltFree" },
];

export function autoBalance(
  current: Percentages,
  ranges: RangesType = CSP_RANGES,
): SpendingPlanData {
  const result: SpendingPlanData = {
    fixedCostsPercent: current.fixedCostsPercent,
    savingsPercent: current.savingsPercent,
    investmentsPercent: current.investmentsPercent,
    guiltFreePercent: current.guiltFreePercent,
  };

  const total = calculateTotal(result);

  if (total < 100) {
    // Distribute remaining to buckets that aren't at max
    let remaining = 100 - total;
    const eligible = BUCKET_KEYS.filter(
      ({ key, rangeKey }) => result[key] < ranges[rangeKey].max,
    );

    if (eligible.length > 0) {
      // Calculate total room available for proportional distribution
      const totalRoom = eligible.reduce(
        (sum, { key, rangeKey }) => sum + (ranges[rangeKey].max - result[key]),
        0,
      );

      for (const { key, rangeKey } of eligible) {
        const room = ranges[rangeKey].max - result[key];
        const share =
          totalRoom > 0
            ? Math.min(room, Math.round((room / totalRoom) * remaining))
            : 0;
        result[key] += share;
        remaining -= share;
      }

      // Distribute any rounding remainder
      if (remaining > 0) {
        for (const { key, rangeKey } of eligible) {
          const room = ranges[rangeKey].max - result[key];
          const add = Math.min(room, remaining);
          result[key] += add;
          remaining -= add;
          if (remaining <= 0) break;
        }
      }
    }
  } else if (total > 100) {
    // Reduce buckets that aren't at min
    let excess = total - 100;
    const eligible = BUCKET_KEYS.filter(
      ({ key, rangeKey }) => result[key] > ranges[rangeKey].min,
    );

    if (eligible.length > 0) {
      const totalReducible = eligible.reduce(
        (sum, { key, rangeKey }) => sum + (result[key] - ranges[rangeKey].min),
        0,
      );

      for (const { key, rangeKey } of eligible) {
        const reducible = result[key] - ranges[rangeKey].min;
        const share =
          totalReducible > 0
            ? Math.min(
                reducible,
                Math.round((reducible / totalReducible) * excess),
              )
            : 0;
        result[key] -= share;
        excess -= share;
      }

      // Handle rounding remainder
      if (excess > 0) {
        for (const { key, rangeKey } of eligible) {
          const reducible = result[key] - ranges[rangeKey].min;
          const remove = Math.min(reducible, excess);
          result[key] -= remove;
          excess -= remove;
          if (excess <= 0) break;
        }
      }
    }
  }

  return result;
}
