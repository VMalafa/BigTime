import { describe, expect, it } from "vitest";
import { parseIcsCalendar } from "./ics.ts";
import { diffAgainstExisting, isConfirmAllTier, naturalKey } from "./ingestion.ts";

// Mirrors the Corbett scheduler's buildICS output byte-for-byte (see
// docs/research/assets/corbett-calendar-scheduler.html): CRLF lines,
// explicit exclusive DTEND even for single-day events, \-escaped text.
function corbettIcs(
  events: Array<{ date: string; end?: string; title: string; note?: string }>
): string {
  const icsDate = (iso: string) => iso.replaceAll("-", "");
  const addDay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const esc = (s: string) =>
    s.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const out = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Corbett Prep//Calendar Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Corbett Prep 2026-27",
  ];
  events.forEach((e, idx) => {
    out.push(
      "BEGIN:VEVENT",
      `UID:${icsDate(e.date)}-${idx}@corbettprep`,
      "DTSTAMP:20260603T120000Z",
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate(e.end ?? addDay(e.date))}`,
      `SUMMARY:${esc(e.title)}`
    );
    if (e.note) out.push(`DESCRIPTION:${esc(e.note)}`);
    out.push("TRANSP:TRANSPARENT", "END:VEVENT");
  });
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}

describe("parseIcsCalendar", () => {
  it("round-trips the Corbett scheduler export shape", () => {
    const ics = corbettIcs([
      {
        date: "2026-08-12",
        title: "First Day of School for Students",
        note: "Noon Dismissal for PreK3, PreK4 & Kindergarten only",
      },
      {
        date: "2026-08-13",
        end: "2026-08-15",
        title: "Noon Dismissal – PreK3, PreK4 & Kindergarten only",
      },
      { date: "2026-12-21", end: "2027-01-05", title: "Winter Break for Students" },
    ]);

    const parsed = parseIcsCalendar(ics);
    expect(parsed.calendarName).toBe("Corbett Prep 2026-27");
    expect(parsed.skipped).toBe(0);
    expect(parsed.events).toEqual([
      {
        startDate: "2026-08-12",
        endDate: undefined,
        title: "First Day of School for Students",
        note: "Noon Dismissal for PreK3, PreK4 & Kindergarten only",
      },
      {
        startDate: "2026-08-13",
        endDate: "2026-08-15",
        title: "Noon Dismissal – PreK3, PreK4 & Kindergarten only",
        note: undefined,
      },
      {
        startDate: "2026-12-21",
        endDate: "2027-01-05",
        title: "Winter Break for Students",
        note: undefined,
      },
    ]);
  });

  it("treats explicit DTEND of start+1 as single-day (exclusive-end convention)", () => {
    const parsed = parseIcsCalendar(
      corbettIcs([{ date: "2026-09-07", title: "Labor Day" }])
    );
    expect(parsed.events[0].endDate).toBeUndefined();
  });

  it("unfolds folded lines and unescapes text", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261015",
      "DTEND;VALUE=DATE:20261016",
      // Folded line: the CRLF + one leading space is the fold marker; the
      // second space belongs to the text itself.
      "SUMMARY:Giving Day\\, all",
      "  campuses\\; rain or shine",
      "DESCRIPTION:Line one\\nLine two",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const parsed = parseIcsCalendar(ics);
    expect(parsed.events[0].title).toBe(
      "Giving Day, all campuses; rain or shine"
    );
    expect(parsed.events[0].note).toBe("Line one\nLine two");
  });

  it("skips timed VEVENTs (outside the date-only subset) without dropping the rest", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20261015T090000Z",
      "DTEND:20261015T100000Z",
      "SUMMARY:Timed meeting",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261016",
      "SUMMARY:All-day thing",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const parsed = parseIcsCalendar(ics);
    expect(parsed.skipped).toBe(1);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].title).toBe("All-day thing");
  });

  it("ignores VTIMEZONE blocks and tolerates a missing DTEND", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20270206",
      "SUMMARY:School Carnival",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const parsed = parseIcsCalendar(ics);
    expect(parsed.events).toEqual([
      {
        startDate: "2027-02-06",
        endDate: undefined,
        title: "School Carnival",
        note: undefined,
      },
    ]);
  });

  it("skips malformed events (no SUMMARY, invalid dates, inverted ranges)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260231", // rolled-over date
      "SUMMARY:Bad date",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261001",
      "END:VEVENT", // no SUMMARY
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261010",
      "DTEND;VALUE=DATE:20261005", // end before start
      "SUMMARY:Inverted",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const parsed = parseIcsCalendar(ics);
    expect(parsed.events).toHaveLength(0);
    expect(parsed.skipped).toBe(3);
  });
});

describe("import dedup + tiering", () => {
  it("re-importing the same set raises nothing new", () => {
    const parsed = [
      { startDate: "2026-08-12", title: "First Day of School" },
      { startDate: "2026-09-07", title: "Labor Day – School Holiday" },
    ];
    const existing = new Set(
      parsed.map((e) => naturalKey(e.startDate, e.title))
    );
    const diff = diffAgainstExisting(parsed, existing);
    expect(diff.fresh).toHaveLength(0);
    expect(diff.existing).toBe(2);
  });

  it("dedup matches on the normalized natural key, not raw text", () => {
    const existing = new Set([
      naturalKey("2026-08-13", "Noon Dismissal – PreK3, PreK4 & Kindergarten only"),
    ]);
    const diff = diffAgainstExisting(
      [
        {
          startDate: "2026-08-13",
          title: "NOON DISMISSAL - PreK3 PreK4 & Kindergarten only!",
        },
      ],
      existing
    );
    expect(diff.fresh).toHaveLength(0);
    expect(diff.existing).toBe(1);
  });

  it("same-day siblings with different titles are both fresh", () => {
    const diff = diffAgainstExisting(
      [
        { startDate: "2027-05-27", title: "8th Grade Graduation Celebration" },
        {
          startDate: "2027-05-27",
          title: "Trimester 3 Ends / Last Day of School for Students",
        },
      ],
      new Set()
    );
    expect(diff.fresh).toHaveLength(2);
  });

  it("collapses exact duplicates within one file", () => {
    const diff = diffAgainstExisting(
      [
        { startDate: "2026-10-12", title: "School Holiday" },
        { startDate: "2026-10-12", title: "School holiday" },
      ],
      new Set()
    );
    expect(diff.fresh).toHaveLength(1);
    expect(diff.duplicatesInFile).toBe(1);
  });

  it("tiers single-day to confirm-all and multi-day to individual", () => {
    expect(isConfirmAllTier({ endDate: undefined })).toBe(true);
    expect(isConfirmAllTier({ endDate: null })).toBe(true);
    expect(isConfirmAllTier({ endDate: "2026-08-15" })).toBe(false);
  });
});
