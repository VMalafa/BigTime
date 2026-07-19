import { describe, expect, it } from "vitest";
import {
  buildDialDriftReview,
  buildSubscriptionAudit,
  investigateAction,
  isFirstDateOfMonth,
} from "@/lib/money-date/deep";
import type { RecurringPattern } from "@/lib/recurring/pattern-engine";

describe("isFirstDateOfMonth", () => {
  it("true when no earlier Date shares the month", () => {
    expect(isFirstDateOfMonth("2026-07-13", ["2026-07-13", "2026-07-27"])).toBe(
      true
    );
    expect(isFirstDateOfMonth("2026-07-27", ["2026-07-13", "2026-07-27"])).toBe(
      false
    );
  });

  it("month boundaries: a late-June Date never deepens mid-July", () => {
    expect(
      isFirstDateOfMonth("2026-07-02", ["2026-06-29", "2026-07-02"])
    ).toBe(true);
    expect(
      isFirstDateOfMonth("2026-01-05", ["2025-12-22", "2026-01-05"])
    ).toBe(true);
  });

  it("the sole Date of a month is first by definition", () => {
    expect(isFirstDateOfMonth("2026-07-13", ["2026-07-13"])).toBe(true);
    expect(isFirstDateOfMonth("2026-07-13", [])).toBe(true);
  });
});

describe("buildDialDriftReview", () => {
  const dials = [
    { category: "TRAVEL", level: 9 },
    { category: "FOOD_DINING", level: 4 },
  ];

  it("pairs stated importance with actual share, biggest gap first", () => {
    const review = buildDialDriftReview(
      dials,
      {
        shares: [
          { dial: "TRAVEL", actualCents: 5_000, sharePercent: 10 },
          { dial: "FOOD_DINING", actualCents: 45_000, sharePercent: 90 },
        ],
        totalCents: 50_000,
        dialedTransactionCount: 8,
      },
      5
    );
    expect(review.suppressed).toBe(false);
    // TRAVEL gap |90−10|=80 vs FOOD |40−90|=50 → TRAVEL first.
    expect(review.rows[0]).toMatchObject({
      name: "Travel & Adventure",
      statedLevel: 9,
      sharePercent: 10,
    });
  });

  it("suppresses honestly below the transaction floor", () => {
    const review = buildDialDriftReview(
      dials,
      { shares: [], totalCents: 0, dialedTransactionCount: 2 },
      5
    );
    expect(review.suppressed).toBe(true);
    // Rows still exist (zero shares) — the card says why it won't read.
    expect(review.rows).toHaveLength(2);
  });
});

function pattern(overrides: Partial<RecurringPattern>): RecurringPattern {
  return {
    merchantPattern: "NETFLIX COM",
    direction: "charge",
    cadence: "MONTHLY",
    typicalAmountCents: 1_549,
    amountToleranceCents: 0,
    occurrences: 4,
    confidence: 0.9,
    firstSeen: new Date("2026-03-12T00:00:00.000Z"),
    lastSeen: new Date("2026-06-12T00:00:00.000Z"),
    transactionIds: [],
    ...overrides,
  };
}

describe("buildSubscriptionAudit", () => {
  it("lists subscription-classified charge patterns, priciest first", () => {
    const rows = buildSubscriptionAudit([
      pattern({}),
      pattern({ merchantPattern: "SPOTIFY USA", typicalAmountCents: 999 }),
      pattern({ merchantPattern: "OAKWOOD APARTMENTS RENT", typicalAmountCents: 180_000 }),
      pattern({ merchantPattern: "ACME PAYROLL", direction: "deposit" }),
    ]);
    expect(rows.map((r) => r.merchant)).toEqual(["Netflix Com", "Spotify Usa"]);
  });
});

describe("investigateAction", () => {
  it("speaks one action for one or many, none for none", () => {
    expect(investigateAction([])).toBeNull();
    expect(investigateAction(["Netflix Com"])).toBe(
      "Investigate Netflix Com — keep it or let it go, together."
    );
    expect(investigateAction(["Netflix Com", "Spotify Usa"])).toBe(
      "Investigate Netflix Com and Spotify Usa — keep or let go, together."
    );
  });
});
