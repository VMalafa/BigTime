import { describe, expect, it } from "vitest";
import type { RecurringPattern } from "../recurring/pattern-engine.ts";
import {
  computeSafeToSpend,
  deriveCurrentPayPeriod,
  deriveEarmarks,
  filterPaycheckDeposits,
  type DepositInput,
} from "./pay-period.ts";

function deposit(iso: string, amountCents: number, description: string): DepositInput {
  return { postedAt: new Date(`${iso}T12:00:00Z`), amountCents, description };
}

function chargePattern(overrides: Partial<RecurringPattern>): RecurringPattern {
  return {
    merchantPattern: "OAKWOOD APARTMENTS RENT",
    direction: "charge",
    cadence: "MONTHLY",
    typicalAmountCents: 180_000,
    amountToleranceCents: 0,
    occurrences: 4,
    confidence: 0.9,
    firstSeen: new Date("2026-03-03"),
    lastSeen: new Date("2026-06-03"),
    transactionIds: [],
    ...overrides,
  };
}

const STREAMS = ["ACME CORP DES PAYROLL", "GLOBEX DES DIRECT DEP"];

describe("filterPaycheckDeposits", () => {
  it("keeps only deposits matching a confirmed income stream", () => {
    const matched = filterPaycheckDeposits(
      [
        deposit("2026-07-03", 250_000, "ACME CORP DES:PAYROLL 001"),
        deposit("2026-07-05", 90_000, "TAX REFUND TREASURY"), // bonus-like
        deposit("2026-07-06", -5_000, "ACME CORP DES:PAYROLL 001"), // not a deposit
      ],
      STREAMS
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].streamPattern).toBe("ACME CORP DES PAYROLL");
  });
});

describe("deriveCurrentPayPeriod", () => {
  it("bounds the period by consecutive paychecks from either partner", () => {
    // Partner A (Acme): biweekly Fridays. Partner B (Globex): 1st/15th.
    // Interleaving produces variable-length periods.
    const paychecks = filterPaycheckDeposits(
      [
        deposit("2026-06-01", 300_000, "GLOBEX DES:DIRECT DEP"),
        deposit("2026-06-05", 250_000, "ACME CORP DES:PAYROLL"),
        deposit("2026-06-15", 300_000, "GLOBEX DES:DIRECT DEP"),
        deposit("2026-06-19", 250_000, "ACME CORP DES:PAYROLL"),
        deposit("2026-07-01", 300_000, "GLOBEX DES:DIRECT DEP"),
      ],
      STREAMS
    );

    // Mid-June: current period is Jun 15 -> Jun 19 (4 days, partner-interleaved).
    const midJune = deriveCurrentPayPeriod(paychecks, new Date("2026-06-17T00:00:00Z"));
    expect(midJune?.start.toISOString().slice(0, 10)).toBe("2026-06-15");
    expect(midJune?.endExclusive.toISOString().slice(0, 10)).toBe("2026-06-19");
    expect(midJune?.projectedEnd).toBe(false);
    expect(midJune?.paycheckCents).toBe(300_000);

    // Earlier June: Jun 5 -> Jun 15 (10 days) — variable lengths, correctly.
    const earlyJune = deriveCurrentPayPeriod(paychecks, new Date("2026-06-10T00:00:00Z"));
    expect(earlyJune?.start.toISOString().slice(0, 10)).toBe("2026-06-05");
    expect(earlyJune?.endExclusive.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("projects the end from each stream's cadence when the next check hasn't landed", () => {
    const paychecks = filterPaycheckDeposits(
      [
        deposit("2026-06-05", 250_000, "ACME CORP DES:PAYROLL"),
        deposit("2026-06-19", 250_000, "ACME CORP DES:PAYROLL"),
        deposit("2026-07-03", 250_000, "ACME CORP DES:PAYROLL"),
      ],
      STREAMS
    );
    const period = deriveCurrentPayPeriod(paychecks, new Date("2026-07-08T00:00:00Z"));
    expect(period?.start.toISOString().slice(0, 10)).toBe("2026-07-03");
    // Biweekly stream: projected next = Jul 3 + 14d = Jul 17.
    expect(period?.endExclusive.toISOString().slice(0, 10)).toBe("2026-07-17");
    expect(period?.projectedEnd).toBe(true);
  });

  it("merges same-day deposits into one boundary and sums the paycheck", () => {
    const paychecks = filterPaycheckDeposits(
      [
        deposit("2026-07-01", 300_000, "GLOBEX DES:DIRECT DEP"),
        deposit("2026-07-01", 250_000, "ACME CORP DES:PAYROLL"),
        deposit("2026-06-15", 300_000, "GLOBEX DES:DIRECT DEP"),
      ],
      STREAMS
    );
    const period = deriveCurrentPayPeriod(paychecks, new Date("2026-07-02T00:00:00Z"));
    expect(period?.start.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(period?.paycheckCents).toBe(550_000);
  });

  it("returns null before any paycheck or with no confirmed streams", () => {
    expect(deriveCurrentPayPeriod([], new Date())).toBeNull();
    const paychecks = filterPaycheckDeposits(
      [deposit("2026-07-03", 250_000, "ACME CORP DES:PAYROLL")],
      STREAMS
    );
    expect(
      deriveCurrentPayPeriod(paychecks, new Date("2026-07-01T00:00:00Z"))
    ).toBeNull();
  });
});

describe("deriveEarmarks", () => {
  const period = {
    start: new Date("2026-07-01T00:00:00Z"),
    endExclusive: new Date("2026-07-15T00:00:00Z"),
    projectedEnd: false,
    paycheckCents: 300_000,
  };

  it("reserves fixed costs whose projected due date falls inside the period", () => {
    // Rent last seen Jun 3, monthly -> projected due Jul 3: inside.
    const { earmarks, undated } = deriveEarmarks(
      [{ name: "Oakwood Apartments Rent", monthlyAmountCents: 180_000 }],
      [chargePattern({})],
      period
    );
    expect(earmarks).toHaveLength(1);
    expect(earmarks[0].dueDate.toISOString().slice(0, 10)).toBe("2026-07-03");
    expect(earmarks[0].amountCents).toBe(180_000);
    expect(undated).toHaveLength(0);
  });

  it("excludes dues outside the period", () => {
    // Utility last seen Jun 20, monthly -> due Jul 20: after period end.
    const { earmarks } = deriveEarmarks(
      [{ name: "Teco Electric", monthlyAmountCents: 15_000 }],
      [
        chargePattern({
          merchantPattern: "TECO ELECTRIC UTIL",
          lastSeen: new Date("2026-06-20"),
          typicalAmountCents: 15_000,
        }),
      ],
      period
    );
    expect(earmarks).toHaveLength(0);
  });

  it("returns items with no detected due date explicitly as undated", () => {
    const { earmarks, undated } = deriveEarmarks(
      [{ name: "Typed By Hand Bill", monthlyAmountCents: 5_000 }],
      [chargePattern({})],
      period
    );
    expect(earmarks).toHaveLength(0);
    expect(undated).toEqual([
      { name: "Typed By Hand Bill", monthlyAmountCents: 5_000 },
    ]);
  });
});

describe("computeSafeToSpend", () => {
  const period = {
    start: new Date("2026-07-01T00:00:00Z"),
    endExclusive: new Date("2026-07-15T00:00:00Z"),
    projectedEnd: false,
    paycheckCents: 300_000,
  };

  it("is paycheck minus Earmarks minus planned savings/investments share", () => {
    const result = computeSafeToSpend(
      period,
      [
        { name: "Rent", amountCents: 180_000, dueDate: new Date("2026-07-03") },
        { name: "Power", amountCents: 15_000, dueDate: new Date("2026-07-10") },
      ],
      { savingsPercent: 10, investmentsPercent: 10 }
    );
    // 3000 - 1950 - 600 = 450
    expect(result.safeToSpendCents).toBe(45_000);
    expect(result.earmarkedCents).toBe(195_000);
    expect(result.plannedSavingsInvestmentsCents).toBe(60_000);
  });

  it("goes negative honestly and handles a missing plan", () => {
    const result = computeSafeToSpend(
      period,
      [{ name: "Rent", amountCents: 320_000, dueDate: new Date("2026-07-03") }],
      null
    );
    expect(result.safeToSpendCents).toBe(-20_000);
    expect(result.plannedSavingsInvestmentsCents).toBe(0);
  });
});
