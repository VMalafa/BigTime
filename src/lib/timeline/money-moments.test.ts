import { describe, expect, it } from "vitest";
import { deriveMoneyMoments } from "./money-moments.ts";
import type { RecurringPattern } from "../recurring/pattern-engine.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-18T12:00:00.000Z");

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY_MS);
}

function paycheck(daysAgo: number, amountCents = 200_000) {
  return {
    deposit: {
      postedAt: daysFromNow(-daysAgo),
      amountCents,
      description: "ACME PAYROLL",
    },
    streamPattern: "ACME PAYROLL",
  };
}

/** Biweekly paycheck history: 42, 28, 14, 0 days ago. */
function biweeklyPaychecks(amountCents = 200_000) {
  return [42, 28, 14, 0].map((d) => paycheck(d, amountCents));
}

function chargePattern(
  merchantPattern: string,
  lastSeenDaysAgo: number,
  typicalAmountCents: number,
  cadence: RecurringPattern["cadence"] = "MONTHLY"
): RecurringPattern {
  return {
    merchantPattern,
    direction: "charge",
    cadence,
    typicalAmountCents,
    amountToleranceCents: 0,
    occurrences: 4,
    confidence: 0.9,
    firstSeen: daysFromNow(-lastSeenDaysAgo - 90),
    lastSeen: daysFromNow(-lastSeenDaysAgo),
    transactionIds: [],
  };
}

describe("deriveMoneyMoments", () => {
  it("projects paydays on the stream's rhythm, each carrying a Money Date", () => {
    const moments = deriveMoneyMoments({
      paychecks: biweeklyPaychecks(),
      chargePatterns: [],
      lineItems: [],
      plan: null,
      now: NOW,
      horizonDays: 30,
    });

    const paydays = moments.filter((m) => m.kind === "PAYDAY");
    const moneyDates = moments.filter((m) => m.kind === "MONEY_DATE");
    // Last deposit today, biweekly: +14 and +28 land inside 30 days.
    expect(paydays.map((m) => m.date)).toEqual([
      daysFromNow(14).toISOString().slice(0, 10),
      daysFromNow(28).toISOString().slice(0, 10),
    ]);
    // The Money Date is payday-timed, one per payday.
    expect(moneyDates.map((m) => m.date)).toEqual(
      paydays.map((m) => m.date)
    );
    expect(paydays.every((m) => m.projected)).toBe(true);
  });

  it("marks a current-period due covered when the paycheck stretches to it", () => {
    const moments = deriveMoneyMoments({
      paychecks: biweeklyPaychecks(200_000),
      chargePatterns: [chargePattern("OAKWOOD RENT", 25, 120_000)],
      lineItems: [
        { name: "Oakwood Rent", monthlyAmountCents: 120_000 },
      ],
      plan: { savingsPercent: 10, investmentsPercent: 10 },
      now: NOW,
      horizonDays: 30,
    });

    // lastSeen 25 days ago + 30-day cadence -> due in 5 days (inside the
    // current biweekly period). $2,000 paycheck - 20% planned = $1,600
    // available >= $1,200 rent.
    const due = moments.find((m) => m.kind === "EARMARK_DUE");
    expect(due).toBeDefined();
    expect(due!.date).toBe(daysFromNow(5).toISOString().slice(0, 10));
    expect(due!.funded).toBe(true);
    expect(due!.nextAction).toBeUndefined();
    expect(due!.detail).toMatch(/^Covered by /);
  });

  it("escalates a genuinely unfunded due date with exactly one next action", () => {
    const moments = deriveMoneyMoments({
      paychecks: biweeklyPaychecks(100_000), // $1,000 paycheck
      chargePatterns: [chargePattern("OAKWOOD RENT", 25, 120_000)],
      lineItems: [{ name: "Oakwood Rent", monthlyAmountCents: 120_000 }],
      plan: { savingsPercent: 10, investmentsPercent: 10 },
      now: NOW,
      horizonDays: 30,
    });

    // $800 available after the planned share; $1,200 rent -> $400 short.
    const due = moments.find((m) => m.kind === "EARMARK_DUE");
    expect(due!.funded).toBe(false);
    expect(due!.nextAction).toBe(
      `Trim guilt-free spending by $400 before ${daysFromNow(5).toLocaleDateString(
        "en-US",
        { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }
      )}`
    );
    expect(due!.detail).toContain("$400 short");
  });

  it("funds current-period dues in due-date order until the paycheck runs out", () => {
    const moments = deriveMoneyMoments({
      paychecks: biweeklyPaychecks(100_000),
      chargePatterns: [
        chargePattern("EARLY BILL", 28, 60_000),
        chargePattern("LATE BILL", 25, 60_000),
      ],
      lineItems: [
        { name: "Early Bill", monthlyAmountCents: 60_000 },
        { name: "Late Bill", monthlyAmountCents: 60_000 },
      ],
      plan: null,
      now: NOW,
      horizonDays: 30,
    });

    const dues = moments.filter((m) => m.kind === "EARMARK_DUE");
    // Early (due +2) fits in $1,000; late (due +5) finds only $400 left.
    expect(dues[0].funded).toBe(true);
    expect(dues[1].funded).toBe(false);
    expect(dues[1].nextAction).toContain("$200");
  });

  it("covers dues beyond the current period by default, naming the paycheck", () => {
    const moments = deriveMoneyMoments({
      paychecks: biweeklyPaychecks(200_000),
      chargePatterns: [chargePattern("GYM MEMBERSHIP", 10, 5_000)],
      lineItems: [{ name: "Gym Membership", monthlyAmountCents: 5_000 }],
      plan: null,
      now: NOW,
      horizonDays: 40,
    });

    // lastSeen 10 days ago + 30 -> due +20 days, beyond the 14-day period
    // end; the +14 projected payday stands behind it.
    const due = moments.find((m) => m.kind === "EARMARK_DUE");
    expect(due!.date).toBe(daysFromNow(20).toISOString().slice(0, 10));
    expect(due!.funded).toBe(true);
    expect(due!.coveredBy).toBe(daysFromNow(14).toISOString().slice(0, 10));
  });

  it("emits nothing without paychecks or matched patterns (no fabricated rhythm)", () => {
    const moments = deriveMoneyMoments({
      paychecks: [],
      chargePatterns: [],
      lineItems: [{ name: "Unmatched Bill", monthlyAmountCents: 10_000 }],
      plan: null,
      now: NOW,
      horizonDays: 30,
    });
    expect(moments).toHaveLength(0);
  });
});
