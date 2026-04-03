export interface WholenessInput {
  hasSpendingPlan: boolean;
  savingsPercent: number;
  investmentsPercent: number;
  debtCount: number;
  aggregateUtilization: number | null;
  hasAutomatedPayments: boolean;
  incomeSourceCount: number;
  hasPayoffPlan: boolean;
}

export interface WholenessResult {
  budget: number;
  save: number;
  debt: number;
  credit: number;
  income: number;
  retirement: number;
  wealth: number;
  insurance: number;
  netWorth: number;
  legacy: number;
  total: number;
}

export function calculateWholenessScore(
  input: WholenessInput,
): WholenessResult {
  // 1. Budget: 10 if has spending plan, 0 if not
  const budget = input.hasSpendingPlan ? 10 : 0;

  // 2. Save: scale by savings percent (5% = 5pts, 10% = 10pts, linear)
  const save = Math.min(10, Math.max(0, input.savingsPercent));

  // 3. Debt: 10 if no debt, 7 if has payoff plan, 3 if has debt but no plan
  let debt: number;
  if (input.debtCount === 0) {
    debt = 10;
  } else if (input.hasPayoffPlan) {
    debt = 7;
  } else {
    debt = 3;
  }

  // 4. Credit: based on utilization, +2 if automated payments (cap at 10)
  let credit: number;
  if (input.aggregateUtilization === null) {
    credit = 5;
  } else if (input.aggregateUtilization < 7) {
    credit = 10;
  } else if (input.aggregateUtilization < 10) {
    credit = 8;
  } else if (input.aggregateUtilization < 30) {
    credit = 5;
  } else {
    credit = 2;
  }
  if (input.hasAutomatedPayments) {
    credit = Math.min(10, credit + 2);
  }

  // 5. Income: 5 base + 2.5 per additional income source (cap at 10)
  const income = Math.min(
    10,
    5 + Math.max(0, input.incomeSourceCount - 1) * 2.5,
  );

  // 6. Retirement: scale by investments percent (5% = 5pts, 10% = 10pts, linear)
  const retirement = Math.min(10, Math.max(0, input.investmentsPercent));

  // 7. Wealth: 3 bonus if investments > 7%, 0 otherwise
  const wealth = input.investmentsPercent > 7 ? 3 : 0;

  // 8. Insurance: 5 (placeholder)
  const insurance = 5;

  // 9. Net worth: 7 if income sources > debt (proxy), 4 otherwise
  // Using income source count > 0 and debt count as proxy
  const netWorth = input.incomeSourceCount > 0 && input.debtCount === 0 ? 7 : 4;

  // 10. Legacy: 3 (placeholder/aspirational)
  const legacy = 3;

  const total =
    budget +
    save +
    debt +
    credit +
    income +
    retirement +
    wealth +
    insurance +
    netWorth +
    legacy;

  return {
    budget,
    save: Math.round(save * 100) / 100,
    debt,
    credit,
    income: Math.round(income * 100) / 100,
    retirement: Math.round(retirement * 100) / 100,
    wealth,
    insurance,
    netWorth,
    legacy,
    total: Math.round(total * 100) / 100,
  };
}
