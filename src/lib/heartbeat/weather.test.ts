import { describe, expect, it } from "vitest";
import {
  computeWeather,
  fundEarmarks,
  type WeatherInput,
} from "@/lib/heartbeat/weather";

const TODAY = "2026-07-16";

function base(overrides: Partial<WeatherInput> = {}): WeatherInput {
  return {
    heartbeatAvailable: true,
    safeToSpendCents: 61800,
    paycheckCents: 300_000,
    plannedSavingsInvestmentsCents: 60_000,
    earmarks: [],
    periodStart: "2026-07-14",
    today: TODAY,
    ...overrides,
  };
}

describe("fundEarmarks", () => {
  it("draws down the paycheck after the planned share, in due-date order", () => {
    const funded = fundEarmarks({
      paycheckCents: 100_000,
      plannedSavingsInvestmentsCents: 20_000,
      earmarks: [
        { name: "Car insurance", amountCents: 30_000, dueDate: "2026-07-26" },
        { name: "Mortgage", amountCents: 60_000, dueDate: "2026-07-15" },
      ],
    });
    // Mortgage (earlier due) takes 60k of the 80k remainder; insurance
    // needs 30k against the last 20k -> unfunded, $100 short.
    expect(funded.map((e) => e.name)).toEqual(["Mortgage", "Car insurance"]);
    expect(funded[0].funded).toBe(true);
    expect(funded[1].funded).toBe(false);
    expect(funded[1].shortfallCents).toBe(10_000);
  });
});

describe("computeWeather — Attention", () => {
  it("fires on negative Safe-to-Spend with one spending action", () => {
    const reading = computeWeather(base({ safeToSpendCents: -12_300 }));
    expect(reading.state).toBe("Attention");
    expect(reading.sentence).toContain("$123 below zero");
    expect(reading.action).toEqual({
      label: "See where it went",
      href: "/dashboard/spending",
    });
  });

  it("fires on an unfunded Earmark due within 3 days", () => {
    const reading = computeWeather(
      base({
        paycheckCents: 10_000,
        plannedSavingsInvestmentsCents: 0,
        earmarks: [
          { name: "Daycare tuition", amountCents: 41_200, dueDate: "2026-07-19" },
        ],
      })
    );
    expect(reading.state).toBe("Attention");
    expect(reading.sentence).toContain("Daycare tuition is due Jul 19");
    expect(reading.action?.label).toBe("Review the Daycare tuition Earmark");
    expect(reading.action?.href).toBe("/dashboard/timeline");
  });

  it("treats a past-due unfunded Earmark as due within the window", () => {
    const reading = computeWeather(
      base({
        paycheckCents: 0,
        plannedSavingsInvestmentsCents: 0,
        earmarks: [
          { name: "Utilities", amountCents: 9_900, dueDate: "2026-07-10" },
        ],
      })
    );
    expect(reading.state).toBe("Attention");
  });

  it("negative Safe-to-Spend outranks a due-soon Earmark (one action only)", () => {
    const reading = computeWeather(
      base({
        safeToSpendCents: -1,
        paycheckCents: 0,
        plannedSavingsInvestmentsCents: 0,
        earmarks: [
          { name: "Utilities", amountCents: 9_900, dueDate: "2026-07-17" },
        ],
      })
    );
    expect(reading.sentence).toContain("below zero");
    expect(reading.action?.href).toBe("/dashboard/spending");
  });
});

describe("computeWeather — Watch", () => {
  it("fires on an unfunded Earmark later in the period", () => {
    const reading = computeWeather(
      base({
        paycheckCents: 10_000,
        plannedSavingsInvestmentsCents: 0,
        earmarks: [
          { name: "Daycare tuition", amountCents: 41_200, dueDate: "2026-07-24" },
        ],
      })
    );
    expect(reading.state).toBe("Watch");
    expect(reading.sentence).toBe(
      "Daycare tuition (due Jul 24) isn't covered by this paycheck yet."
    );
    expect(reading.action?.label).toBe("Review the Daycare tuition Earmark");
  });

  it("fires when no paycheck has landed in 40+ days", () => {
    const reading = computeWeather(base({ periodStart: "2026-06-01" }));
    expect(reading.state).toBe("Watch");
    expect(reading.sentence).toBe("No paycheck has landed in 45 days.");
    expect(reading.action?.href).toBe("/settings/connections");
  });

  it("reads Watch when the heartbeat can't run yet (never a false Steady)", () => {
    const reading = computeWeather({
      heartbeatAvailable: false,
      heartbeatReason:
        "Confirm an income stream (Income page) to start the heartbeat — Pay Periods are bounded by your paychecks.",
      today: TODAY,
    });
    expect(reading.state).toBe("Watch");
    expect(reading.action).toEqual({
      label: "Confirm an income stream",
      href: "/dashboard/income",
    });
  });
});

describe("computeWeather — Steady", () => {
  it("reads Steady with no action when everything due is covered", () => {
    const reading = computeWeather(
      base({
        earmarks: [
          { name: "Mortgage", amountCents: 60_000, dueDate: "2026-07-15" },
        ],
      })
    );
    expect(reading.state).toBe("Steady");
    expect(reading.sentence).toBe("Everything due this Pay Period is covered.");
    expect(reading.action).toBeNull();
  });

  it("a fresh paycheck under 40 days stays Steady", () => {
    const reading = computeWeather(base({ periodStart: "2026-06-10" }));
    expect(reading.state).toBe("Steady");
  });
});

describe("Honesty Rule", () => {
  it("an unfunded Earmark can never read Steady", () => {
    for (const dueDate of ["2026-07-10", "2026-07-17", "2026-07-24", "2026-08-30"]) {
      const reading = computeWeather(
        base({
          paycheckCents: 0,
          plannedSavingsInvestmentsCents: 0,
          earmarks: [{ name: "Anything", amountCents: 100, dueDate }],
        })
      );
      expect(reading.state).not.toBe("Steady");
    }
  });

  it("every non-Steady reading carries exactly one action", () => {
    const readings = [
      computeWeather(base({ safeToSpendCents: -1 })),
      computeWeather(
        base({
          paycheckCents: 0,
          plannedSavingsInvestmentsCents: 0,
          earmarks: [{ name: "X", amountCents: 100, dueDate: "2026-07-25" }],
        })
      ),
      computeWeather(base({ periodStart: "2026-06-01" })),
      computeWeather({ heartbeatAvailable: false, today: TODAY }),
    ];
    for (const reading of readings) {
      expect(reading.state).not.toBe("Steady");
      expect(reading.action).not.toBeNull();
    }
  });
});
