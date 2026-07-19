import { describe, expect, it } from "vitest";
import {
  deriveSetupWalk,
  planStepHref,
  type SetupInputs,
} from "@/lib/setup/walk";

function inputs(overrides: Partial<SetupInputs> = {}): SetupInputs {
  return {
    hasLinkedAccount: false,
    hasIncome: false,
    hasPlan: false,
    hasNamedDials: false,
    hasCostsOrDebts: false,
    automationDone: false,
    ...overrides,
  };
}

describe("deriveSetupWalk", () => {
  it("a fresh household starts at Link accounts (skippable)", () => {
    const walk = deriveSetupWalk(inputs());
    expect(walk.complete).toBe(false);
    // The first gating gap is Income; Link guides but never gates.
    expect(walk.next?.key).toBe("INCOME");
    expect(walk.steps[0]).toMatchObject({ key: "LINK", optional: true });
  });

  it("setup complete = Safe-to-Spend computable: income + plan + dials", () => {
    expect(
      deriveSetupWalk(
        inputs({ hasIncome: true, hasPlan: true, hasNamedDials: true })
      ).complete
    ).toBe(true);
    // Linking, costs/debts, and wire-up never gate.
    expect(
      deriveSetupWalk(
        inputs({
          hasIncome: true,
          hasPlan: true,
          hasNamedDials: true,
          hasLinkedAccount: false,
          hasCostsOrDebts: false,
          automationDone: false,
        })
      ).complete
    ).toBe(true);
  });

  it("each missing exit ingredient keeps setup open", () => {
    expect(
      deriveSetupWalk(inputs({ hasPlan: true, hasNamedDials: true })).complete
    ).toBe(false);
    expect(
      deriveSetupWalk(inputs({ hasIncome: true, hasNamedDials: true }))
        .complete
    ).toBe(false);
    expect(
      deriveSetupWalk(inputs({ hasIncome: true, hasPlan: true })).complete
    ).toBe(false);
  });

  it("the finger moves through gating gaps in journey order", () => {
    expect(deriveSetupWalk(inputs({ hasIncome: true })).next?.key).toBe(
      "PLAN"
    );
    expect(
      deriveSetupWalk(
        inputs({ hasIncome: true, hasPlan: true, hasNamedDials: true })
      ).next?.key
      // Complete households still get pointed at skippable leftovers…
    ).toBe("LINK");
  });

  it("with everything done there is nothing to point at", () => {
    const walk = deriveSetupWalk(
      inputs({
        hasLinkedAccount: true,
        hasIncome: true,
        hasPlan: true,
        hasNamedDials: true,
        hasCostsOrDebts: true,
        automationDone: true,
      })
    );
    expect(walk.complete).toBe(true);
    expect(walk.next).toBeNull();
  });

  it("PLAN is done only when both CSP and Dials are", () => {
    expect(
      deriveSetupWalk(inputs({ hasPlan: true })).steps.find(
        (s) => s.key === "PLAN"
      )?.done
    ).toBe(false);
    expect(
      deriveSetupWalk(inputs({ hasPlan: true, hasNamedDials: true })).steps.find(
        (s) => s.key === "PLAN"
      )?.done
    ).toBe(true);
  });
});

describe("planStepHref", () => {
  it("walks CSP first, then Dials", () => {
    expect(planStepHref({ hasPlan: false, hasNamedDials: false })).toBe(
      "/dashboard/spending-plan"
    );
    expect(planStepHref({ hasPlan: true, hasNamedDials: false })).toBe(
      "/dashboard/money-dials"
    );
  });
});
