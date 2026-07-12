import { describe, expect, it } from "vitest";
import {
  detectRecurringPatterns,
  type RecurringTransactionInput,
} from "./pattern-engine.ts";

let idCounter = 0;
function txn(
  isoDate: string,
  amountCents: number,
  description: string,
  isTransfer = false
): RecurringTransactionInput {
  return {
    id: `t${++idCounter}`,
    postedAt: new Date(`${isoDate}T12:00:00Z`),
    amountCents,
    description,
    isTransfer,
  };
}

/** N occurrences spaced `gapDays` apart starting at `start`. */
function series(
  start: string,
  gapDays: number,
  count: number,
  amountCents: number | ((i: number) => number),
  description: string
): RecurringTransactionInput[] {
  const startMs = new Date(`${start}T12:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) =>
    txn(
      new Date(startMs + i * gapDays * 86_400_000).toISOString().slice(0, 10),
      typeof amountCents === "function" ? amountCents(i) : amountCents,
      description
    )
  );
}

describe("cadence classification with synthetic fixtures", () => {
  it("detects a weekly charge", () => {
    const [pattern] = detectRecurringPatterns(
      series("2026-04-01", 7, 8, -1200, "SQ *COFFEE CLUB 44")
    );
    expect(pattern.cadence).toBe("WEEKLY");
    expect(pattern.direction).toBe("charge");
    expect(pattern.typicalAmountCents).toBe(1200);
  });

  it("detects a biweekly paycheck-like deposit stream", () => {
    const [pattern] = detectRecurringPatterns(
      series("2026-04-03", 14, 7, 250_000, "ACME CORP DES:PAYROLL 8871")
    );
    expect(pattern.cadence).toBe("BIWEEKLY");
    expect(pattern.direction).toBe("deposit");
    expect(pattern.confidence).toBeGreaterThan(0.8);
  });

  it("distinguishes semi-monthly (1st/15th) from biweekly", () => {
    const semiMonthly = [
      txn("2026-03-01", 300_000, "EMPLOYER DES:SALARY"),
      txn("2026-03-15", 300_000, "EMPLOYER DES:SALARY"),
      txn("2026-04-01", 300_000, "EMPLOYER DES:SALARY"),
      txn("2026-04-15", 300_000, "EMPLOYER DES:SALARY"),
      txn("2026-05-01", 300_000, "EMPLOYER DES:SALARY"),
      txn("2026-05-15", 300_000, "EMPLOYER DES:SALARY"),
    ];
    expect(detectRecurringPatterns(semiMonthly)[0].cadence).toBe("SEMI_MONTHLY");

    // A true biweekly stream drifts across days of the month.
    const biweekly = series("2026-03-06", 14, 7, 300_000, "EMPLOYER DES:SALARY");
    expect(detectRecurringPatterns(biweekly)[0].cadence).toBe("BIWEEKLY");
  });

  it("detects a monthly subscription", () => {
    const [pattern] = detectRecurringPatterns(
      series("2026-01-14", 30, 6, -1549, "NETFLIX.COM 866-579-7172")
    );
    expect(pattern.cadence).toBe("MONTHLY");
    expect(pattern.merchantPattern).toBe("NETFLIX COM");
  });

  it("detects a quarterly insurance-style charge", () => {
    const [pattern] = detectRecurringPatterns(
      series("2025-10-05", 91, 4, -48_750, "GEICO *AUTO 4411")
    );
    expect(pattern.cadence).toBe("QUARTERLY");
  });

  it("detects an annual renewal from two occurrences", () => {
    const [pattern] = detectRecurringPatterns([
      txn("2025-06-20", -9_900, "NAMECHEAP.COM RENEWAL"),
      txn("2026-06-21", -9_900, "NAMECHEAP.COM RENEWAL"),
    ]);
    expect(pattern.cadence).toBe("ANNUAL");
    expect(pattern.occurrences).toBe(2);
  });
});

describe("amount drift and clustering", () => {
  it("keeps a drifting utility bill as one pattern", () => {
    const utility = series(
      "2026-01-10",
      30,
      6,
      (i) => -[13_800, 15_200, 12_400, 14_900, 16_100, 13_300][i],
      "TECO ELECTRIC UTIL PYMT"
    );
    const patterns = detectRecurringPatterns(utility);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].cadence).toBe("MONTHLY");
    expect(patterns[0].occurrences).toBe(6);
    expect(patterns[0].amountToleranceCents).toBeGreaterThan(0);
  });

  it("separates a subscription from the same merchant's unrelated purchases", () => {
    const mixed = [
      ...series("2026-01-05", 30, 6, -1499, "AMAZON MKTPL SUBSCRIBE"),
      txn("2026-01-17", -8_342, "AMAZON MKTPL SUBSCRIBE"),
      txn("2026-02-02", -25_610, "AMAZON MKTPL SUBSCRIBE"),
      txn("2026-03-11", -4_405, "AMAZON MKTPL SUBSCRIBE"),
    ];
    const patterns = detectRecurringPatterns(mixed);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].typicalAmountCents).toBe(1499);
    expect(patterns[0].occurrences).toBe(6);
  });
});

describe("coincidence guard", () => {
  it("gives random-gap groups no pattern", () => {
    const random = [
      txn("2026-01-03", -5_000, "LOCAL RESTAURANT"),
      txn("2026-01-09", -5_000, "LOCAL RESTAURANT"),
      txn("2026-02-27", -5_000, "LOCAL RESTAURANT"),
      txn("2026-03-02", -5_000, "LOCAL RESTAURANT"),
      txn("2026-03-30", -5_000, "LOCAL RESTAURANT"),
    ];
    expect(detectRecurringPatterns(random)).toHaveLength(0);
  });

  it("scores clean cadences above noisy ones", () => {
    const clean = detectRecurringPatterns(
      series("2026-01-01", 30, 6, -1000, "CLEAN SUB")
    )[0];
    const noisy = detectRecurringPatterns(
      [
        txn("2026-01-01", -1000, "NOISY SUB"),
        txn("2026-02-04", -1000, "NOISY SUB"),
        txn("2026-03-02", -1000, "NOISY SUB"),
        txn("2026-04-05", -1000, "NOISY SUB"),
      ],
      { minConfidence: 0 }
    )[0];
    expect(clean.confidence).toBeGreaterThan(noisy.confidence);
  });

  it("requires enough occurrences per cadence", () => {
    // Two 30-day gaps could be luck; three monthly occurrences is the floor.
    expect(
      detectRecurringPatterns(series("2026-01-01", 30, 2, -1000, "TOO FEW"))
    ).toHaveLength(0);
  });

  it("excludes Transfers entirely", () => {
    const transfers = series("2026-01-01", 30, 6, -40_000, "PAYMENT TO CARD").map(
      (t) => ({ ...t, isTransfer: true })
    );
    expect(detectRecurringPatterns(transfers)).toHaveLength(0);
  });

  it("separates charges from deposits at the same merchant", () => {
    const both = [
      ...series("2026-01-01", 30, 5, -2_000, "VENMO"),
      ...series("2026-01-15", 30, 5, 2_000, "VENMO"),
    ];
    const patterns = detectRecurringPatterns(both);
    expect(patterns).toHaveLength(2);
    expect(new Set(patterns.map((p) => p.direction))).toEqual(
      new Set(["charge", "deposit"])
    );
  });
});
