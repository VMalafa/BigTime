import { beforeEach, describe, expect, it } from "vitest";
import {
  useFlowStore,
  type BonusEntry,
  type FixedCostLineItem,
  type IncomeEntry,
} from "@/lib/store/flow-store";

function income(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: overrides.id ?? `income-${Math.random()}`,
    name: "Salary",
    monthlyAmount: 5000,
    isAfterTax: true,
    ...overrides,
  };
}

function bonus(overrides: Partial<BonusEntry> = {}): BonusEntry {
  return {
    id: overrides.id ?? `bonus-${Math.random()}`,
    name: "Performance bonus",
    grossAmount: 1000,
    estimatedTaxRate: 35,
    frequency: "ANNUAL",
    ...overrides,
  };
}

function lineItem(
  overrides: Partial<FixedCostLineItem> = {}
): FixedCostLineItem {
  return {
    id: overrides.id ?? `item-${Math.random()}`,
    category: "HOUSING",
    name: "Rent",
    monthlyAmount: 1500,
    sortOrder: 0,
    ...overrides,
  };
}

beforeEach(() => {
  useFlowStore.getState().reset();
});

describe("income selectors", () => {
  it("getTotalMonthlyIncome sums all income sources", () => {
    const store = useFlowStore.getState();
    store.addIncome(income({ monthlyAmount: 4000 }));
    store.addIncome(income({ monthlyAmount: 2500, name: "Freelance" }));

    expect(useFlowStore.getState().getTotalMonthlyIncome()).toBe(6500);
  });

  it("getTotalMonthlyIncome is 0 with no sources", () => {
    expect(useFlowStore.getState().getTotalMonthlyIncome()).toBe(0);
  });

  it("getTotalAnnualBonusNet nets out tax and multiplies by frequency", () => {
    const store = useFlowStore.getState();
    // 1000 gross at 35% tax = 650 net, quarterly = 2600/yr
    store.addBonus(bonus({ frequency: "QUARTERLY" }));

    expect(useFlowStore.getState().getTotalAnnualBonusNet()).toBeCloseTo(2600);
  });

  it("getEffectiveMonthlyIncome adds the monthly bonus equivalent", () => {
    const store = useFlowStore.getState();
    store.addIncome(income({ monthlyAmount: 6000 }));
    // 1200 gross at 50% tax, semi-annual = 1200/yr net = 100/mo
    store.addBonus(
      bonus({ grossAmount: 1200, estimatedTaxRate: 50, frequency: "SEMI_ANNUAL" })
    );

    expect(useFlowStore.getState().getEffectiveMonthlyIncome()).toBeCloseTo(
      6100
    );
  });
});

describe("fixed-cost selectors", () => {
  it("getFixedCostsTotalMonthly sums line items", () => {
    const store = useFlowStore.getState();
    store.addFixedCostLineItem(lineItem({ monthlyAmount: 1500 }));
    store.addFixedCostLineItem(
      lineItem({ monthlyAmount: 300, name: "Car insurance", category: "INSURANCE" })
    );

    expect(useFlowStore.getState().getFixedCostsTotalMonthly()).toBe(1800);
  });

  it("getFixedCostsTotalMonthly is 0 before any plan exists", () => {
    expect(useFlowStore.getState().getFixedCostsTotalMonthly()).toBe(0);
  });

  it("getSuggestedFixedCostsPercent derives percent of income", () => {
    const store = useFlowStore.getState();
    store.addIncome(income({ monthlyAmount: 6000 }));
    store.addFixedCostLineItem(lineItem({ monthlyAmount: 1800 }));

    expect(useFlowStore.getState().getSuggestedFixedCostsPercent()).toBe(30);
  });

  it("getSuggestedFixedCostsPercent is 0 with no income", () => {
    const store = useFlowStore.getState();
    store.addFixedCostLineItem(lineItem({ monthlyAmount: 1800 }));

    expect(useFlowStore.getState().getSuggestedFixedCostsPercent()).toBe(0);
  });

  it("getRemainingDiscretionaryMonthly subtracts fixed costs from income", () => {
    const store = useFlowStore.getState();
    store.addIncome(income({ monthlyAmount: 6000 }));
    store.addFixedCostLineItem(lineItem({ monthlyAmount: 1800 }));

    expect(
      useFlowStore.getState().getRemainingDiscretionaryMonthly()
    ).toBe(4200);
  });
});

describe("suggested percent sync", () => {
  it("keeps fixedCostsPercent in sync with line items until overridden", () => {
    const store = useFlowStore.getState();
    store.addIncome(income({ monthlyAmount: 6000 }));
    store.addFixedCostLineItem(lineItem({ id: "rent", monthlyAmount: 1800 }));

    expect(useFlowStore.getState().spendingPlan?.fixedCostsPercent).toBe(30);

    useFlowStore.getState().updateFixedCostLineItem("rent", {
      monthlyAmount: 2400,
    });
    expect(useFlowStore.getState().spendingPlan?.fixedCostsPercent).toBe(40);
  });

  it("stops syncing once the user overrides the percent", () => {
    const store = useFlowStore.getState();
    store.addIncome(income({ monthlyAmount: 6000 }));
    store.addFixedCostLineItem(lineItem({ id: "rent", monthlyAmount: 1800 }));
    useFlowStore.getState().setFixedCostsOverridden(true);

    useFlowStore.getState().updateFixedCostLineItem("rent", {
      monthlyAmount: 2400,
    });
    expect(useFlowStore.getState().spendingPlan?.fixedCostsPercent).toBe(30);
  });

  it("removing a line item re-derives the suggested percent", () => {
    const store = useFlowStore.getState();
    store.addIncome(income({ monthlyAmount: 6000 }));
    store.addFixedCostLineItem(lineItem({ id: "rent", monthlyAmount: 1800 }));
    store.addFixedCostLineItem(
      lineItem({ id: "car", monthlyAmount: 600, name: "Car payment" })
    );

    expect(useFlowStore.getState().spendingPlan?.fixedCostsPercent).toBe(40);

    useFlowStore.getState().removeFixedCostLineItem("car");
    expect(useFlowStore.getState().spendingPlan?.fixedCostsPercent).toBe(30);
  });
});
