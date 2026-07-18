import { describe, expect, it } from "vitest";
import {
  buildTodayStrip,
  isSchoolQuirkCategory,
  stripDayLabel,
  type StripEventInput,
} from "@/lib/timeline/today-strip";

const TODAY = "2026-07-18";

function event(overrides: Partial<StripEventInput>): StripEventInput {
  return {
    id: "e1",
    date: TODAY,
    endDate: null,
    title: "Noon Dismissal",
    category: "dismissal",
    costCents: null,
    profileName: null,
    assigneeExtra: null,
    ...overrides,
  };
}

describe("isSchoolQuirkCategory", () => {
  it("reads day anomalies as quirks", () => {
    for (const c of [
      "dismissal",
      "Noon Dismissal",
      "holiday",
      "break",
      "School Closed",
      "closure",
      "no school",
      "half day",
      "half-day",
      "early release",
    ]) {
      expect(isSchoolQuirkCategory(c)).toBe(true);
    }
  });

  it("leaves ordinary categories alone", () => {
    for (const c of ["event", "academic", "concert", "money"]) {
      expect(isSchoolQuirkCategory(c)).toBe(false);
    }
  });
});

describe("buildTodayStrip", () => {
  it("selects only today's and tomorrow's rows, in day order", () => {
    const strip = buildTodayStrip({
      events: [
        event({ id: "a", date: "2026-07-19", title: "Tomorrow Event" }),
        event({ id: "b", date: TODAY, title: "Today Event" }),
        event({ id: "c", date: "2026-07-20", title: "Beyond" }),
        event({ id: "d", date: "2026-07-17", title: "Yesterday" }),
      ],
      earmarks: [],
      todayIso: TODAY,
    });
    expect(strip.rows.map((r) => r.title)).toEqual([
      "Today Event",
      "Tomorrow Event",
    ]);
    expect(strip.rows.map((r) => r.day)).toEqual(["TODAY", "TOMORROW"]);
  });

  it("a multi-day Event covering both days renders once, on today", () => {
    const strip = buildTodayStrip({
      events: [
        event({ id: "a", date: "2026-07-16", endDate: "2026-07-21" }),
      ],
      earmarks: [],
      todayIso: TODAY,
    });
    expect(strip.rows).toHaveLength(1);
    expect(strip.rows[0].day).toBe("TODAY");
  });

  it("flags an unassigned quirk and reports it for Weather targeting", () => {
    const strip = buildTodayStrip({
      events: [event({ id: "a", date: "2026-07-19" })],
      earmarks: [],
      todayIso: TODAY,
    });
    expect(strip.rows[0].needsPickup).toBe(true);
    expect(strip.unassignedQuirk).toEqual({
      title: "Noon Dismissal",
      date: "2026-07-19",
    });
  });

  it("an assigned quirk shows its chip and raises nothing", () => {
    const strip = buildTodayStrip({
      events: [event({ assigneeExtra: "EXTENDED_DAY" })],
      earmarks: [],
      todayIso: TODAY,
    });
    expect(strip.rows[0].chip).toBe("Extended Day");
    expect(strip.rows[0].needsPickup).toBe(false);
    expect(strip.unassignedQuirk).toBeNull();
  });

  it("a non-quirk unassigned Event is a plain row", () => {
    const strip = buildTodayStrip({
      events: [event({ category: "event" })],
      earmarks: [],
      todayIso: TODAY,
    });
    expect(strip.rows[0].needsPickup).toBe(false);
    expect(strip.unassignedQuirk).toBeNull();
  });

  it("renders due Earmarks in covered-by-default tone", () => {
    const strip = buildTodayStrip({
      events: [],
      earmarks: [
        {
          name: "Mortgage",
          amountCents: 285_000,
          dueDate: TODAY,
          funded: true,
          shortfallCents: 0,
        },
        {
          name: "Daycare",
          amountCents: 41_200,
          dueDate: "2026-07-19",
          funded: false,
          shortfallCents: 10_000,
        },
        {
          name: "Later",
          amountCents: 1,
          dueDate: "2026-07-25",
          funded: true,
          shortfallCents: 0,
        },
      ],
      todayIso: TODAY,
    });
    expect(strip.rows).toHaveLength(2);
    expect(strip.rows[0].detail).toBe("Covered — settled rhythm.");
    expect(strip.rows[0].funded).toBe(true);
    expect(strip.rows[1].detail).toBe("This paycheck comes up $100 short.");
    expect(strip.rows[1].funded).toBe(false);
  });

  it("empty window means no rows (the empty-state sentence is the UI's)", () => {
    const strip = buildTodayStrip({ events: [], earmarks: [], todayIso: TODAY });
    expect(strip.rows).toHaveLength(0);
    expect(strip.unassignedQuirk).toBeNull();
  });
});

describe("stripDayLabel", () => {
  it("carries the date, extensible for travel context", () => {
    expect(stripDayLabel("TODAY", TODAY)).toBe("Today · Sat, Jul 18");
    expect(stripDayLabel("TOMORROW", "2026-07-19")).toBe(
      "Tomorrow · Sun, Jul 19"
    );
    expect(stripDayLabel("TODAY", TODAY, "you're in Denver, home +2h")).toBe(
      "Today · Sat, Jul 18 · you're in Denver, home +2h"
    );
  });
});
