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

export const FIXED_COSTS_RECOMMENDED_MIN = CSP_RANGES.fixedCosts.min;
export const FIXED_COSTS_RECOMMENDED_MAX = CSP_RANGES.fixedCosts.max;

export type FixedCostCategory =
  | "HOUSING"
  | "INSURANCE"
  | "UTILITIES"
  | "TRANSPORTATION"
  | "SUBSCRIPTIONS"
  | "DEBT_MINIMUMS"
  | "OTHER";

export interface FixedCostCategoryMeta {
  key: FixedCostCategory;
  label: string;
  hint: string;
}

// Ordered by commonness: most users split their fixed costs into the first 3–4 buckets.
export const FIXED_COST_CATEGORIES: readonly FixedCostCategoryMeta[] = [
  { key: "HOUSING", label: "Housing", hint: "Rent, mortgage, HOA, property tax" },
  { key: "UTILITIES", label: "Utilities", hint: "Electric, gas, water, internet, phone" },
  { key: "INSURANCE", label: "Insurance", hint: "Health, auto, home/renters, life" },
  { key: "TRANSPORTATION", label: "Transportation", hint: "Car payment, gas, transit pass, parking" },
  { key: "DEBT_MINIMUMS", label: "Debt Minimums", hint: "Minimum payments on loans or cards" },
  { key: "SUBSCRIPTIONS", label: "Subscriptions", hint: "Streaming, software, memberships" },
  { key: "OTHER", label: "Other", hint: "Anything else that's truly non-negotiable" },
] as const;

export const FIXED_COST_MAX_AMOUNT = 99999.99;
