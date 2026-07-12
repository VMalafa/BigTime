import { describe, expect, it } from "vitest";
import type { DebtInput } from "@/lib/calculations/credit-health";
import { buildCreditStrategy } from "@/lib/calculations/credit-strategy";

function card(overrides: Partial<DebtInput> = {}): DebtInput {
  return {
    id: overrides.id ?? "card-1",
    name: "Credit card",
    balance: 4000,
    apr: 24,
    minimumPayment: 100,
    debtType: "CREDIT_CARD",
    creditLimit: 5000,
    ...overrides,
  };
}

describe("buildCreditStrategy", () => {
  it("focuses on payment history when there is no revolving debt", () => {
    const result = buildCreditStrategy([]);

    expect(result.primaryFocus).toBe("Payment history");
    expect(result.actions.map((a) => a.id)).not.toContain("paydown-high-util");
  });

  it("prioritizes paydown when aggregate utilization is above 30%", () => {
    // 4000 / 5000 = 80% utilization
    const result = buildCreditStrategy([card()]);

    expect(result.primaryFocus).toBe("Bring utilization below 30%");
    const ids = result.actions.map((a) => a.id);
    expect(ids).toContain("autopay-all");
    expect(ids).toContain("paydown-high-util");
    // Autopay (payment history, 35% of score) always outranks paydown
    expect(ids.indexOf("autopay-all")).toBeLessThan(
      ids.indexOf("paydown-high-util")
    );
  });

  it("suggests fine-tuning between 10% and 30% utilization", () => {
    // 1000 / 5000 = 20%
    const result = buildCreditStrategy([card({ balance: 1000 })]);

    expect(result.primaryFocus).toBe("Push utilization into single digits");
    expect(result.actions.map((a) => a.id)).toContain("fine-tune-util");
  });

  it("celebrates single-digit utilization and marks milestones reached", () => {
    // 250 / 5000 = 5%
    const result = buildCreditStrategy([card({ balance: 250 })]);

    expect(result.primaryFocus).toBe("Protect what you've built");
    const reached = Object.fromEntries(
      result.milestones.map((m) => [m.label, m.reached])
    );
    expect(reached["Below 30%"]).toBe(true);
    expect(reached["Below 10%"]).toBe(true);
    expect(reached["Below 7%"]).toBe(true);
  });

  it("omits actions the user has already taken", () => {
    const result = buildCreditStrategy([card()], {
      autopayAllAccounts: true,
      monitoringEnrolled: true,
      frozenBureaus: true,
    });

    const ids = result.actions.map((a) => a.id);
    expect(ids).not.toContain("autopay-all");
    expect(ids).not.toContain("enroll-monitoring");
    expect(ids).not.toContain("freeze-bureaus");
  });

  it("ignores installment debt when computing utilization", () => {
    const result = buildCreditStrategy([
      card({ balance: 250 }),
      {
        id: "auto",
        name: "Auto loan",
        balance: 20000,
        apr: 6,
        minimumPayment: 400,
        debtType: "AUTO_LOAN",
      },
    ]);

    // 250 / 5000 = 5% — the auto loan must not drag utilization up
    expect(result.primaryFocus).toBe("Protect what you've built");
  });
});
