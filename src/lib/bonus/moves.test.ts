import { describe, expect, it } from "vitest";
import {
  buildMoveReminder,
  matchMovesToTransfers,
  type PlannedMove,
  type TransferLegInput,
} from "@/lib/bonus/moves";

const NOW = new Date("2026-07-19T12:00:00Z");

function move(
  id: string,
  amountCents: number,
  createdIso: string,
  status: "PLANNED" | "DONE" = "PLANNED",
  label = "Hawaii"
): PlannedMove {
  return { id, amountCents, status, label, createdAt: new Date(createdIso) };
}

function leg(id: string, iso: string, amountCents: number): TransferLegInput {
  return { id, postedAt: new Date(iso), amountCents };
}

describe("matchMovesToTransfers", () => {
  it("marks a move done when an exact-amount Transfer lands after it", () => {
    const matches = matchMovesToTransfers(
      [move("m1", 45_000, "2026-07-10T00:00:00Z")],
      [leg("t1", "2026-07-12T00:00:00Z", -45_000)],
      NOW
    );
    expect(matches).toEqual([{ moveId: "m1", transactionId: "t1" }]);
  });

  it("ignores Transfers that predate the plan (beyond posting slack)", () => {
    expect(
      matchMovesToTransfers(
        [move("m1", 45_000, "2026-07-10T00:00:00Z")],
        [leg("t1", "2026-07-05T00:00:00Z", -45_000)],
        NOW
      )
    ).toHaveLength(0);
  });

  it("never matches on a different amount", () => {
    expect(
      matchMovesToTransfers(
        [move("m1", 45_000, "2026-07-10T00:00:00Z")],
        [leg("t1", "2026-07-12T00:00:00Z", -44_900)],
        NOW
      )
    ).toHaveLength(0);
  });

  it("uses each Transfer leg at most once, earliest leg first", () => {
    const matches = matchMovesToTransfers(
      [
        move("m1", 45_000, "2026-07-10T00:00:00Z"),
        move("m2", 45_000, "2026-07-10T00:00:00Z"),
      ],
      [
        leg("t2", "2026-07-14T00:00:00Z", -45_000),
        leg("t1", "2026-07-12T00:00:00Z", -45_000),
      ],
      NOW
    );
    expect(matches).toEqual([
      { moveId: "m1", transactionId: "t1" },
      { moveId: "m2", transactionId: "t2" },
    ]);
  });

  it("skips moves already done", () => {
    expect(
      matchMovesToTransfers(
        [move("m1", 45_000, "2026-07-10T00:00:00Z", "DONE")],
        [leg("t1", "2026-07-12T00:00:00Z", -45_000)],
        NOW
      )
    ).toHaveLength(0);
  });
});

describe("buildMoveReminder", () => {
  it("stays silent while the move is fresh", () => {
    expect(
      buildMoveReminder([move("m1", 45_000, "2026-07-15T00:00:00Z")], NOW)
    ).toBeNull();
  });

  it("is one quiet line after ~7 days, in the household's words", () => {
    expect(
      buildMoveReminder([move("m1", 45_000, "2026-07-10T00:00:00Z")], NOW)
    ).toBe("Still planning to move $450 to Hawaii?");
  });

  it("shows cents only when the amount has them", () => {
    expect(
      buildMoveReminder([move("m1", 45_050, "2026-07-10T00:00:00Z")], NOW)
    ).toBe("Still planning to move $450.50 to Hawaii?");
  });

  it("is one line even with several overdue moves — the oldest speaks", () => {
    const line = buildMoveReminder(
      [
        move("m2", 20_000, "2026-07-08T00:00:00Z", "PLANNED", "Chase card"),
        move("m1", 45_000, "2026-07-06T00:00:00Z"),
      ],
      NOW
    );
    expect(line).toBe("Still planning to move $450 to Hawaii?");
  });

  it("stays silent once everything moved", () => {
    expect(
      buildMoveReminder([move("m1", 45_000, "2026-07-01T00:00:00Z", "DONE")], NOW)
    ).toBeNull();
  });
});
