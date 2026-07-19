import { describe, expect, it } from "vitest";
import { goalImpact, payoffImpact } from "@/lib/bonus/impact";

describe("payoffImpact", () => {
  it("shortens the payoff by whole months", () => {
    // $5,000 at 0% APR, $500/mo minimum: 10 months; $1,500 extra → 7.
    const impact = payoffImpact(
      { balanceCents: 500_000, aprPercent: 0, minimumPaymentCents: 50_000 },
      150_000
    );
    expect(impact).toEqual({ monthsBefore: 10, monthsAfter: 7, monthsSaved: 3 });
  });

  it("accounts for interest — saved months beat the 0% read", () => {
    const impact = payoffImpact(
      { balanceCents: 800_000, aprPercent: 24, minimumPaymentCents: 25_000 },
      280_000
    );
    expect(impact).not.toBeNull();
    expect(impact!.monthsSaved).toBeGreaterThan(0);
    expect(impact!.monthsAfter).toBeLessThan(impact!.monthsBefore);
  });

  it("clears the debt entirely when the share covers the balance", () => {
    const impact = payoffImpact(
      { balanceCents: 100_000, aprPercent: 12, minimumPaymentCents: 10_000 },
      100_000
    );
    expect(impact!.monthsAfter).toBe(0);
  });

  it("is null when the minimum never amortizes the balance", () => {
    expect(
      payoffImpact(
        { balanceCents: 1_000_000, aprPercent: 30, minimumPaymentCents: 1_000 },
        50_000
      )
    ).toBeNull();
  });

  it("is null for a zero balance or zero minimum", () => {
    expect(
      payoffImpact(
        { balanceCents: 0, aprPercent: 10, minimumPaymentCents: 10_000 },
        50_000
      )
    ).toBeNull();
    expect(
      payoffImpact(
        { balanceCents: 100_000, aprPercent: 10, minimumPaymentCents: 0 },
        50_000
      )
    ).toBeNull();
  });
});

describe("goalImpact", () => {
  it("reads 34% → 41% for the fixture-shaped numbers", () => {
    // $3,400 of $10,000, adding $750.
    expect(goalImpact(340_000, 1_000_000, 75_000)).toEqual({
      beforePercent: 34,
      afterPercent: 41,
      milestonesCrossed: 1,
    });
  });

  it("counts a multi-Milestone leap", () => {
    // 34% → 59% crosses 40% and 50%.
    expect(goalImpact(340_000, 1_000_000, 250_000)!.milestonesCrossed).toBe(2);
  });

  it("crosses nothing inside one decade", () => {
    expect(goalImpact(340_000, 1_000_000, 40_000)).toEqual({
      beforePercent: 34,
      afterPercent: 38,
      milestonesCrossed: 0,
    });
  });

  it("clamps at 100% when the windfall overshoots the target", () => {
    const impact = goalImpact(900_000, 1_000_000, 500_000);
    expect(impact!.afterPercent).toBe(100);
  });

  it("is null without a real target", () => {
    expect(goalImpact(0, 0, 50_000)).toBeNull();
  });
});
