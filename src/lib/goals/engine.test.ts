import { describe, expect, it } from "vitest";
import {
  detectMilestones,
  goalHorizonLabel,
  goalPercentFunded,
  goalProgressCents,
  sliceEarmark,
  type GoalInput,
} from "@/lib/goals/engine";

function goal(overrides: Partial<GoalInput> = {}): GoalInput {
  return {
    id: "g1",
    name: "Hawaii",
    emoji: "🌺",
    targetCents: 1_000_000,
    linkedBalanceCents: 340_000,
    manualCents: 0,
    isSpotlight: true,
    sliceCents: 15_000,
    ...overrides,
  };
}

describe("goal progress ownership", () => {
  it("the feed balance owns progress when linked", () => {
    expect(goalProgressCents(goal({ manualCents: 999_999 }))).toBe(340_000);
  });

  it("manual amount stands only while unlinked", () => {
    expect(
      goalProgressCents(goal({ linkedBalanceCents: null, manualCents: 50_000 }))
    ).toBe(50_000);
  });

  it("percent floors and caps at 100", () => {
    expect(goalPercentFunded(goal())).toBe(34);
    expect(goalPercentFunded(goal({ linkedBalanceCents: 2_000_000 }))).toBe(100);
    expect(goalPercentFunded(goal({ targetCents: 0 }))).toBe(0);
  });

  it("speaks the horizon line", () => {
    expect(goalHorizonLabel(goal())).toBe("🌺 Hawaii · 34% funded");
    expect(goalHorizonLabel(goal({ emoji: null }))).toBe("Hawaii · 34% funded");
  });
});

describe("sliceEarmark", () => {
  const periodEnd = new Date("2026-07-28T00:00:00.000Z");

  it("reserves the Spotlight slice through the period", () => {
    const earmark = sliceEarmark(goal(), periodEnd);
    expect(earmark).toEqual({
      name: "Hawaii slice",
      amountCents: 15_000,
      dueDate: new Date("2026-07-27T00:00:00.000Z"),
    });
  });

  it("no spotlight or zero slice, no reservation", () => {
    expect(sliceEarmark(null, periodEnd)).toBeNull();
    expect(sliceEarmark(goal({ sliceCents: 0 }), periodEnd)).toBeNull();
  });
});

describe("detectMilestones", () => {
  it("fires each un-recorded 10% step, idempotently", () => {
    const first = detectMilestones({
      goals: [goal()],
      totalDebtCents: 0,
      debts: [],
      existingKeys: new Set(),
    });
    expect(first.map((m) => m.key)).toEqual([
      "goal:g1:10",
      "goal:g1:20",
      "goal:g1:30",
    ]);

    const second = detectMilestones({
      goals: [goal()],
      totalDebtCents: 0,
      debts: [],
      existingKeys: new Set(first.map((m) => m.key)),
    });
    expect(second).toHaveLength(0);
  });

  it("anchors debt crossings on a silent baseline, then fires per $1,000", () => {
    const first = detectMilestones({
      goals: [],
      totalDebtCents: 3_050_000, // $30.5k → floor 30
      debts: [],
      existingKeys: new Set(),
    });
    expect(first).toEqual([
      expect.objectContaining({
        kind: "DEBT_BASELINE",
        key: "debt-floor:30",
        silent: true,
      }),
    ]);

    // Debt falls to $27,900 → floor 27 → crossings 29, 28, 27.
    const second = detectMilestones({
      goals: [],
      totalDebtCents: 2_790_000,
      debts: [],
      existingKeys: new Set(["debt-floor:30"]),
    });
    expect(second.map((m) => m.key)).toEqual([
      "debt-floor:29",
      "debt-floor:28",
      "debt-floor:27",
    ]);
    expect(second.every((m) => m.kind === "DEBT_THOUSAND")).toBe(true);

    // Refetch at the same debt: silence.
    expect(
      detectMilestones({
        goals: [],
        totalDebtCents: 2_790_000,
        debts: [],
        existingKeys: new Set([
          "debt-floor:30",
          "debt-floor:29",
          "debt-floor:28",
          "debt-floor:27",
        ]),
      })
    ).toHaveLength(0);
  });

  it("a debt at zero fires once", () => {
    const input = {
      goals: [],
      totalDebtCents: 0,
      debts: [{ id: "d1", name: "E2E Card", balanceCents: 0 }],
      existingKeys: new Set<string>(),
    };
    const first = detectMilestones(input);
    expect(first.map((m) => m.key)).toEqual(["debt-zero:d1"]);
    expect(
      detectMilestones({ ...input, existingKeys: new Set(["debt-zero:d1"]) })
    ).toHaveLength(0);
  });

  it("debt-free households never seed a baseline", () => {
    expect(
      detectMilestones({
        goals: [],
        totalDebtCents: 0,
        debts: [],
        existingKeys: new Set(),
      })
    ).toHaveLength(0);
  });
});
