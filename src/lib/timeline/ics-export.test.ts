import { describe, expect, it } from "vitest";
import { buildIcsExport } from "./ics-export.ts";
import { parseIcsCalendar } from "./ics.ts";
import { naturalKey } from "./ingestion.ts";

const NOW = new Date("2026-07-18T12:00:00.000Z");

describe("buildIcsExport", () => {
  it("emits the scheduler's exact shape: exclusive DTEND, notes in DESCRIPTION", () => {
    const ics = buildIcsExport({
      calendarName: "E2E School 2026-27",
      events: [
        { startDate: "2026-09-07", title: "Labor Day – School Holiday" },
        {
          startDate: "2026-12-21",
          endDate: "2027-01-05",
          title: "Winter Break for Students",
          note: "Extended Day Closed",
        },
      ],
      now: NOW,
    });

    // Single-day: explicit exclusive DTEND = start + 1 (scheduler parity).
    expect(ics).toContain("DTSTART;VALUE=DATE:20260907");
    expect(ics).toContain("DTEND;VALUE=DATE:20260908");
    // Multi-day: the stored exclusive end passes through untouched.
    expect(ics).toContain("DTSTART;VALUE=DATE:20261221");
    expect(ics).toContain("DTEND;VALUE=DATE:20270105");
    expect(ics).toContain("DESCRIPTION:Extended Day Closed");
    expect(ics).toContain("TRANSP:TRANSPARENT");
    expect(ics).toContain("X-WR-CALNAME:E2E School 2026-27");
    // CRLF line endings — Apple/Google import care.
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("escapes commas, semicolons, backslashes, and newlines", () => {
    const ics = buildIcsExport({
      calendarName: "X",
      events: [
        {
          startDate: "2026-10-15",
          title: "Giving Day, all campuses; rain or shine",
          note: "Line one\nLine two",
        },
      ],
      now: NOW,
    });
    expect(ics).toContain("SUMMARY:Giving Day\\, all campuses\\; rain or shine");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });

  it("round-trips through the #55 parser with no dupes and no drift", () => {
    const events = [
      { startDate: "2026-09-07", title: "Labor Day – School Holiday" },
      {
        startDate: "2026-12-21",
        endDate: "2027-01-05",
        title: "Winter Break for Students",
        note: "Fri 7/31–Fri 8/7",
      },
      {
        startDate: "2027-05-27",
        title: "Trimester 3 Ends / Last Day of School for Students",
      },
    ];
    const parsed = parseIcsCalendar(
      buildIcsExport({ calendarName: "Round Trip", events, now: NOW })
    );

    expect(parsed.calendarName).toBe("Round Trip");
    expect(parsed.skipped).toBe(0);
    expect(parsed.events).toHaveLength(events.length);
    parsed.events.forEach((event, i) => {
      // No drift: dates, exclusive ends, titles, and notes survive intact —
      // so the natural key matches and a re-import raises nothing new.
      expect(event.startDate).toBe(events[i].startDate);
      expect(event.endDate).toBe(events[i].endDate);
      expect(event.title).toBe(events[i].title);
      expect(event.note).toBe(events[i].note);
      expect(naturalKey(event.startDate, event.title)).toBe(
        naturalKey(events[i].startDate, events[i].title)
      );
    });
  });
});
