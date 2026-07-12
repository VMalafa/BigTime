import { describe, expect, it } from "vitest";
import type { DebtInput } from "@/lib/calculations/debt-payoff";
import { calculateAllStrategies } from "@/lib/calculations/debt-payoff";

function debt(overrides: Partial<DebtInput> = {}): DebtInput {
  return {
    id: overrides.id ?? "d1",
    name: "Debt",
    balance: 1000,
    apr: 0,
    minimumPayment: 100,
    debtType: "PERSONAL_LOAN",
    ...overrides,
  };
}

describe("calculateAllStrategies", () => {
  it("pays off a zero-APR debt with minimums alone, no interest", () => {
    const { avalanche } = calculateAllStrategies([debt()], 0);

    expect(avalanche.totalMonths).toBe(10);
    expect(avalanche.totalInterestPaid).toBe(0);
    expect(avalanche.monthlySchedule).toHaveLength(10);
    expect(avalanche.monthlySchedule.at(-1)?.totalBalance).toBe(0);
  });

  it("labels each strategy result", () => {
    const results = calculateAllStrategies([debt()], 50);

    expect(results.avalanche.strategy).toBe("avalanche");
    expect(results.snowball.strategy).toBe("snowball");
    expect(results.utilization.strategy).toBe("utilization");
  });

  it("avalanche never pays more total interest than snowball", () => {
    const debts = [
      debt({ id: "high-apr", name: "Card", balance: 8000, apr: 28, minimumPayment: 200, debtType: "CREDIT_CARD", creditLimit: 10000 }),
      debt({ id: "low-apr", name: "Loan", balance: 2000, apr: 5, minimumPayment: 100 }),
    ];
    const { avalanche, snowball } = calculateAllStrategies(debts, 300);

    expect(avalanche.totalInterestPaid).toBeLessThanOrEqual(
      snowball.totalInterestPaid
    );
  });

  it("snowball retires the smallest balance first", () => {
    const debts = [
      debt({ id: "big", name: "Big", balance: 8000, apr: 28, minimumPayment: 200 }),
      debt({ id: "small", name: "Small", balance: 500, apr: 5, minimumPayment: 50 }),
    ];
    const { snowball } = calculateAllStrategies(debts, 200);

    const byId = Object.fromEntries(
      snowball.perDebtSchedule.map((d) => [d.debtId, d.payoffMonth])
    );
    expect(byId["small"]).toBeLessThan(byId["big"]);
  });

  it("records utilization milestones as a revolving balance falls", () => {
    const debts = [
      debt({
        id: "card",
        name: "Card",
        balance: 4000,
        apr: 20,
        minimumPayment: 100,
        debtType: "CREDIT_CARD",
        creditLimit: 5000,
      }),
    ];
    const { utilization } = calculateAllStrategies(debts, 500);

    const thresholds = utilization.utilizationMilestones
      .filter((m) => m.debtId === "card")
      .map((m) => m.threshold)
      .sort((a, b) => b - a);
    expect(thresholds).toEqual([30, 10, 7]);

    // Milestones must be recorded in descending-threshold order over time
    const months = [...utilization.utilizationMilestones]
      .sort((a, b) => b.threshold - a.threshold)
      .map((m) => m.month);
    expect([...months].sort((a, b) => a - b)).toEqual(months);
  });
});
