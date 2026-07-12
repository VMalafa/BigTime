import { describe, expect, it } from "vitest";
import type { RecurringPattern } from "../recurring/pattern-engine.ts";
import {
  buildDebtProposals,
  buildFixedCostProposals,
  guessFixedCostCategory,
  monthlyAmountCents,
} from "./proposals.ts";

function pattern(overrides: Partial<RecurringPattern> = {}): RecurringPattern {
  return {
    merchantPattern: "NETFLIX COM",
    direction: "charge",
    cadence: "MONTHLY",
    typicalAmountCents: 1549,
    amountToleranceCents: 0,
    occurrences: 5,
    confidence: 0.9,
    firstSeen: new Date("2026-02-01"),
    lastSeen: new Date("2026-06-01"),
    transactionIds: [],
    ...overrides,
  };
}

const NO_DECISIONS = new Set<string>();

describe("monthlyAmountCents", () => {
  it("normalizes each cadence to a monthly equivalent", () => {
    expect(monthlyAmountCents(pattern({ cadence: "MONTHLY", typicalAmountCents: 1200 }))).toBe(1200);
    expect(monthlyAmountCents(pattern({ cadence: "SEMI_MONTHLY", typicalAmountCents: 1200 }))).toBe(2400);
    expect(monthlyAmountCents(pattern({ cadence: "BIWEEKLY", typicalAmountCents: 1200 }))).toBe(2600);
    expect(monthlyAmountCents(pattern({ cadence: "QUARTERLY", typicalAmountCents: 3000 }))).toBe(1000);
    expect(monthlyAmountCents(pattern({ cadence: "ANNUAL", typicalAmountCents: 12000 }))).toBe(1000);
  });
});

describe("guessFixedCostCategory", () => {
  it("maps common merchant shapes to fixed-cost categories", () => {
    expect(guessFixedCostCategory("CITIZENS DES MTG PMT")).toBe("HOUSING");
    expect(guessFixedCostCategory("GEICO AUTO INS")).toBe("INSURANCE");
    expect(guessFixedCostCategory("TECO ELECTRIC UTIL")).toBe("UTILITIES");
    expect(guessFixedCostCategory("NETFLIX COM")).toBe("SUBSCRIPTIONS");
    expect(guessFixedCostCategory("DEPT EDUCATION DES STUDENT LN")).toBe("DEBT_MINIMUMS");
    expect(guessFixedCostCategory("MYSTERY VENDOR")).toBe("OTHER");
  });
});

describe("buildFixedCostProposals — tiering per the Proposal glossary", () => {
  const income = { monthlyIncomeCents: 600_000, decidedPatterns: NO_DECISIONS, existingLineItemNames: [] };

  it("bundles clear-cut Proposals under confirm-all", () => {
    const tiers = buildFixedCostProposals([pattern()], income);
    expect(tiers.confirmAll).toHaveLength(1);
    expect(tiers.individual).toHaveLength(0);
    expect(tiers.confirmAll[0].fixedCostCategory).toBe("SUBSCRIPTIONS");
  });

  it("sends ambiguous (low-confidence) Proposals to the individual tier", () => {
    const tiers = buildFixedCostProposals([pattern({ confidence: 0.6 })], income);
    expect(tiers.confirmAll).toHaveLength(0);
    expect(tiers.individual[0].individualReason).toContain("cadence");
  });

  it("sends plan-moving amounts to the individual tier", () => {
    const tiers = buildFixedCostProposals(
      [pattern({ merchantPattern: "OAKWOOD APARTMENTS RENT", typicalAmountCents: 180_000 })],
      income
    );
    expect(tiers.individual).toHaveLength(1);
    expect(tiers.individual[0].individualReason).toContain("move the plan");
    expect(tiers.individual[0].fixedCostCategory).toBe("HOUSING");
  });

  it("sends odd cadences to the individual tier with a monthly equivalent", () => {
    const tiers = buildFixedCostProposals(
      [pattern({ cadence: "QUARTERLY", typicalAmountCents: 30_000 })],
      income
    );
    expect(tiers.individual[0].individualReason).toContain("cadence");
    expect(tiers.individual[0].monthlyAmountCents).toBe(10_000);
  });

  it("never re-proposes a decided pattern (dismissal is remembered)", () => {
    const tiers = buildFixedCostProposals([pattern()], {
      ...income,
      decidedPatterns: new Set(["NETFLIX COM"]),
    });
    expect(tiers.confirmAll).toHaveLength(0);
    expect(tiers.individual).toHaveLength(0);
  });

  it("skips deposits and merchants already on the plan", () => {
    const tiers = buildFixedCostProposals(
      [
        pattern({ direction: "deposit" }),
        pattern({ merchantPattern: "STATE FARM INSURANCE" }),
      ],
      { ...income, existingLineItemNames: ["State Farm"] }
    );
    expect(tiers.confirmAll).toHaveLength(0);
    expect(tiers.individual).toHaveLength(0);
  });
});

describe("buildDebtProposals", () => {
  const card = {
    id: "acct-card",
    name: "Sapphire Card",
    institution: "Chase",
    accountType: "CREDIT_CARD",
    currentBalanceCents: -125_000,
    mapped: false,
  };

  it("proposes unmapped CREDIT_CARD/LOAN accounts with feed-owned balance", () => {
    const proposals = buildDebtProposals(
      [
        card,
        { ...card, id: "acct-loan", name: "Auto Loan", accountType: "LOAN", currentBalanceCents: -900_000 },
        { ...card, id: "acct-check", accountType: "CHECKING" },
        { ...card, id: "acct-mapped", mapped: true },
      ],
      NO_DECISIONS
    );
    expect(proposals.map((p) => p.linkedAccountId)).toEqual(["acct-card", "acct-loan"]);
    expect(proposals[0].suggestedDebtType).toBe("CREDIT_CARD");
    expect(proposals[0].balanceCents).toBe(125_000);
    expect(proposals[1].suggestedDebtType).toBe("PERSONAL_LOAN");
  });

  it("never re-proposes a decided account", () => {
    expect(buildDebtProposals([card], new Set(["acct-card"]))).toHaveLength(0);
  });
});
