import { describe, expect, it } from "vitest";
import { computeManualHeartbeat } from "@/lib/heartbeat/manual";

const NOW = new Date("2026-07-18T15:00:00.000Z");

describe("computeManualHeartbeat", () => {
  it("computes a calendar-month Safe-to-Spend from stated income", () => {
    const hb = computeManualHeartbeat({
      monthlyIncomeCents: 600_000,
      lineItems: [
        { name: "Rent", monthlyAmountCents: 180_000 },
        { name: "Utilities", monthlyAmountCents: 20_000 },
      ],
      plan: { savingsPercent: 10, investmentsPercent: 10 },
      now: NOW,
    });
    expect(hb).not.toBeNull();
    // 6000 − 2000 fixed − 1200 planned = 2800
    expect(hb!.safeToSpendCents).toBe(280_000);
    expect(hb!.paycheckCents).toBe(600_000);
    expect(hb!.earmarkedCents).toBe(200_000);
    expect(hb!.plannedSavingsInvestmentsCents).toBe(120_000);
    expect(hb!.periodStart.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(hb!.periodEndExclusive.toISOString()).toBe(
      "2026-08-01T00:00:00.000Z"
    );
    expect(hb!.undated).toHaveLength(2);
  });

  it("honestly negative when fixed costs outrun stated income", () => {
    const hb = computeManualHeartbeat({
      monthlyIncomeCents: 100_000,
      lineItems: [{ name: "Rent", monthlyAmountCents: 180_000 }],
      plan: null,
      now: NOW,
    });
    expect(hb!.safeToSpendCents).toBe(-80_000);
  });

  it("returns null without stated income — nothing to compute from", () => {
    expect(
      computeManualHeartbeat({
        monthlyIncomeCents: 0,
        lineItems: [],
        plan: null,
        now: NOW,
      })
    ).toBeNull();
  });
});
