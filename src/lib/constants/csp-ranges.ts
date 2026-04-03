export const CSP_RANGES = {
  fixedCosts: { min: 50, max: 60, label: "Fixed Costs", description: "Rent, utilities, insurance, minimum debt payments, subscriptions" },
  savings: { min: 5, max: 10, label: "Savings", description: "Emergency fund, short-term goals, vacation fund" },
  investments: { min: 5, max: 10, label: "Investments", description: "401(k), IRA, brokerage, retirement savings" },
  guiltFree: { min: 20, max: 35, label: "Guilt-Free Spending", description: "Everything you love — dining, shopping, hobbies, fun" },
} as const;

export type CSPBucket = keyof typeof CSP_RANGES;

export const CSP_BUCKET_COLORS = {
  fixedCosts: "cat-blue",
  savings: "cat-green",
  investments: "cat-plum",
  guiltFree: "accent-gold",
} as const;
