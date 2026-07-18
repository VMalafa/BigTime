import { describe, expect, it } from "vitest";
import {
  assigneeChipLabel,
  extraAssigneeName,
  isExtraAssignee,
  matchesPersonFilter,
} from "@/lib/timeline/assignee";

describe("assignee vocabulary", () => {
  it("recognizes exactly the two fixed extras", () => {
    expect(isExtraAssignee("SITTER")).toBe(true);
    expect(isExtraAssignee("EXTENDED_DAY")).toBe(true);
    expect(isExtraAssignee("GRANDMA")).toBe(false);
    expect(isExtraAssignee("")).toBe(false);
  });

  it("labels extras in human words", () => {
    expect(extraAssigneeName("SITTER")).toBe("Sitter");
    expect(extraAssigneeName("EXTENDED_DAY")).toBe("Extended Day");
  });
});

describe("assigneeChipLabel", () => {
  it("prefers the Profile name, then the extra, then no chip", () => {
    expect(
      assigneeChipLabel({ profileName: "Dad", assigneeExtra: null })
    ).toBe("Dad");
    expect(
      assigneeChipLabel({ profileName: null, assigneeExtra: "EXTENDED_DAY" })
    ).toBe("Extended Day");
    expect(
      assigneeChipLabel({ profileName: null, assigneeExtra: null })
    ).toBeNull();
  });
});

describe("matchesPersonFilter", () => {
  const unassigned = { profileId: null, assigneeExtra: null } as const;
  const dads = { profileId: "p-dad", assigneeExtra: null } as const;
  const sitters = { profileId: null, assigneeExtra: "SITTER" } as const;

  it("ALL passes everything", () => {
    expect(matchesPersonFilter("ALL", unassigned)).toBe(true);
    expect(matchesPersonFilter("ALL", dads)).toBe(true);
    expect(matchesPersonFilter("ALL", sitters)).toBe(true);
  });

  it("unassigned Events are household-wide and pass every filter", () => {
    expect(matchesPersonFilter("p-dad", unassigned)).toBe(true);
    expect(matchesPersonFilter("SITTER", unassigned)).toBe(true);
  });

  it("a Profile filter matches only that Profile's Events", () => {
    expect(matchesPersonFilter("p-dad", dads)).toBe(true);
    expect(matchesPersonFilter("p-mom", dads)).toBe(false);
    expect(matchesPersonFilter("p-dad", sitters)).toBe(false);
  });

  it("an extra filter matches only that extra's Events", () => {
    expect(matchesPersonFilter("SITTER", sitters)).toBe(true);
    expect(matchesPersonFilter("EXTENDED_DAY", sitters)).toBe(false);
    expect(matchesPersonFilter("SITTER", dads)).toBe(false);
  });
});
