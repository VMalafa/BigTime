import { describe, expect, it } from "vitest";
import {
  deriveRenewalDrafts,
  pickLoudRenewal,
  renewalDetail,
  renewalState,
  type RenewalEventInput,
} from "@/lib/renewals/radar";
import type { RecurringPattern } from "@/lib/recurring/pattern-engine";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const TODAY = "2026-07-18";

function pattern(overrides: Partial<RecurringPattern> = {}): RecurringPattern {
  return {
    merchantPattern: "ACME INSURANCE ANNUAL PREMIUM",
    direction: "charge",
    cadence: "ANNUAL",
    typicalAmountCents: 128_500,
    amountToleranceCents: 0,
    occurrences: 2,
    confidence: 0.9,
    firstSeen: new Date("2025-06-06T12:00:00.000Z"),
    lastSeen: new Date("2026-06-06T12:00:00.000Z"),
    transactionIds: [],
    ...overrides,
  };
}

describe("deriveRenewalDrafts", () => {
  it("an annual charge implies next term's renewal, one year out", () => {
    const drafts = deriveRenewalDrafts([pattern()], NOW);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toEqual({
      title: "Acme Insurance Annual Premium renewal",
      date: "2027-06-06",
      costCents: 128_500,
    });
  });

  it("semi-annual charges qualify; shorter cadences and deposits do not", () => {
    const drafts = deriveRenewalDrafts(
      [
        pattern({ cadence: "SEMI_ANNUAL", merchantPattern: "storage unit" }),
        pattern({ cadence: "MONTHLY", merchantPattern: "netflix" }),
        pattern({ cadence: "QUARTERLY", merchantPattern: "water bill" }),
        pattern({ direction: "deposit", merchantPattern: "acme payroll" }),
      ],
      NOW
    );
    expect(drafts.map((d) => d.title)).toEqual(["Storage Unit renewal"]);
    expect(drafts[0].date).toBe("2026-12-06");
  });

  it("projects past the present when the last charge is old", () => {
    const drafts = deriveRenewalDrafts(
      [pattern({ lastSeen: new Date("2024-06-06T12:00:00.000Z") })],
      NOW
    );
    // 2024-06-06 + 365d → 2025-06-06 (past) + 365d → 2026-06-06 (past,
    // it's July) + 365d → 2027-06-06.
    expect(drafts[0].date).toBe("2027-06-06");
  });
});

function renewal(overrides: Partial<RenewalEventInput> = {}): RenewalEventInput {
  return {
    id: "r1",
    date: "2026-08-30",
    category: "renewal",
    handledAt: null,
    ...overrides,
  };
}

describe("renewalState", () => {
  it("quiet future beyond 30 days, upcoming inside 30, escalated inside 7", () => {
    expect(renewalState(renewal({ date: "2026-08-30" }), TODAY)).toBe("FUTURE");
    expect(renewalState(renewal({ date: "2026-08-10" }), TODAY)).toBe(
      "UPCOMING"
    );
    expect(renewalState(renewal({ date: "2026-07-24" }), TODAY)).toBe(
      "ESCALATED"
    );
    expect(renewalState(renewal({ date: "2026-07-18" }), TODAY)).toBe(
      "ESCALATED"
    );
  });

  it("handled quiets immediately, whatever the date", () => {
    expect(
      renewalState(
        renewal({ date: "2026-07-19", handledAt: "2026-07-18T13:00:00Z" }),
        TODAY
      )
    ).toBe("HANDLED");
  });

  it("non-renewal categories never enter the radar", () => {
    expect(
      renewalState(renewal({ category: "dismissal", date: "2026-07-19" }), TODAY)
    ).toBe("FUTURE");
  });
});

describe("pickLoudRenewal — no red-alert stacking", () => {
  it("only the soonest escalated renewal goes loud", () => {
    const events = [
      renewal({ id: "a", date: "2026-07-23" }),
      renewal({ id: "b", date: "2026-07-20" }),
      renewal({ id: "c", date: "2026-08-10" }),
    ];
    expect(pickLoudRenewal(events, TODAY)).toBe("b");
  });

  it("handling the loud one promotes the next", () => {
    const events = [
      renewal({ id: "a", date: "2026-07-23" }),
      renewal({ id: "b", date: "2026-07-20", handledAt: "2026-07-18T13:00:00Z" }),
    ];
    expect(pickLoudRenewal(events, TODAY)).toBe("a");
  });

  it("null when nothing is escalated", () => {
    expect(pickLoudRenewal([renewal({ date: "2026-09-01" })], TODAY)).toBeNull();
  });
});

describe("renewalDetail", () => {
  it("speaks each state's line", () => {
    expect(renewalDetail(renewal({ date: "2026-07-20" }), TODAY)).toBe(
      "Renews in 2 days — handle it or it stays loud."
    );
    expect(renewalDetail(renewal({ date: "2026-07-18" }), TODAY)).toBe(
      "Renewal date reached — handle it or dismiss it."
    );
    expect(renewalDetail(renewal({ date: "2026-08-10" }), TODAY)).toBe(
      "Upcoming renewal · 23 days out"
    );
    expect(
      renewalDetail(
        renewal({ handledAt: "2026-07-18T13:00:00Z", date: "2026-07-20" }),
        TODAY
      )
    ).toBe("Handled ✓");
    expect(renewalDetail(renewal({ date: "2026-12-01" }), TODAY)).toBeNull();
  });
});
