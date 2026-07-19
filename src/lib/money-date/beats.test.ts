import { describe, expect, it } from "vitest";
import {
  applyMoneyDateOverrides,
  deriveDateInsight,
} from "@/lib/money-date/beats";
import type { MonthSummary } from "@/lib/spending/month-summary";
import type { MoneyMoment } from "@/lib/timeline/money-moments";

function summary(overrides: Partial<MonthSummary> = {}): MonthSummary {
  return {
    incomeCents: 600_000,
    incomeSource: "feed",
    buckets: [
      { bucket: "FIXED_COSTS", planPercent: 50, actualCents: 300_000, actualPercent: 50 },
      { bucket: "SAVINGS", planPercent: 10, actualCents: 60_000, actualPercent: 10 },
      { bucket: "INVESTMENTS", planPercent: 10, actualCents: 60_000, actualPercent: 10 },
      { bucket: "GUILT_FREE", planPercent: 30, actualCents: 180_000, actualPercent: 30 },
    ],
    uncategorizedCount: 0,
    uncategorizedCents: 0,
    ...overrides,
  };
}

describe("deriveDateInsight", () => {
  it("names the biggest movement vs plan, in dollars, over", () => {
    const s = summary();
    s.buckets[3].actualCents = 211_000; // guilt-free +$310 over its 180k plan
    expect(deriveDateInsight(s)).toBe(
      "Guilt-Free Spending ran $310 over plan last month — the biggest movement, worth a look together."
    );
  });

  it("an under-plan movement reads as in your favor", () => {
    const s = summary();
    s.buckets[0].actualCents = 240_000; // fixed costs -$600
    expect(deriveDateInsight(s)).toBe(
      "Fixed Costs came in $600 under plan last month — the biggest movement, and it's in your favor."
    );
  });

  it("on-plan months say so; empty months admit it", () => {
    expect(deriveDateInsight(summary())).toBe(
      "Last month landed on plan across every bucket — steady hands."
    );
    expect(deriveDateInsight(summary({ incomeCents: 0 }))).toBe(
      "Not enough categorized spending last month to read a movement yet."
    );
  });
});

describe("applyMoneyDateOverrides", () => {
  const moments: MoneyMoment[] = [
    { kind: "PAYDAY", date: "2026-07-27", title: "Payday" },
    {
      kind: "MONEY_DATE",
      date: "2026-07-27",
      title: "Money Date",
      detail: "Ten payday minutes together — always ending on the goal",
    },
    { kind: "MONEY_DATE", date: "2026-08-10", title: "Money Date" },
  ];

  it("a rescheduled Date moves to its chosen evening and says so", () => {
    const out = applyMoneyDateOverrides(moments, [
      { periodStart: "2026-07-27", status: "RESCHEDULED", scheduledFor: "2026-07-29" },
    ]);
    const moved = out.find((m) => m.kind === "MONEY_DATE" && m.date === "2026-07-29");
    expect(moved?.detail).toContain("moved, never skipped");
    // The other projected Date and the payday pass through untouched.
    expect(out.find((m) => m.kind === "PAYDAY")?.date).toBe("2026-07-27");
    expect(out.filter((m) => m.kind === "MONEY_DATE")).toHaveLength(2);
  });

  it("a completed Date reads kept", () => {
    const out = applyMoneyDateOverrides(moments, [
      { periodStart: "2026-07-27", status: "COMPLETED", scheduledFor: null },
    ]);
    expect(
      out.find((m) => m.kind === "MONEY_DATE" && m.date === "2026-07-27")?.detail
    ).toContain("Kept");
  });

  it("no override, no change", () => {
    expect(applyMoneyDateOverrides(moments, [])).toEqual(moments);
  });

  it("a moved Date whose payday moment is already past gets injected", () => {
    const out = applyMoneyDateOverrides(moments, [
      // 2026-07-13's payday moment doesn't exist (it's behind us).
      { periodStart: "2026-07-13", status: "RESCHEDULED", scheduledFor: "2026-07-21" },
    ]);
    const injected = out.find(
      (m) => m.kind === "MONEY_DATE" && m.date === "2026-07-21"
    );
    expect(injected?.detail).toContain("moved, never skipped");
    // Completed past Dates inject nothing — the past river isn't v1.
    expect(
      applyMoneyDateOverrides(moments, [
        { periodStart: "2026-07-13", status: "COMPLETED", scheduledFor: null },
      ])
    ).toEqual(moments);
  });
});
