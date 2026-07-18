import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FEED_NAME,
  buildFeedIcs,
  parseFeedPath,
  type FeedEventRow,
} from "@/lib/timeline/feed";
import { createRateLimiter } from "@/lib/timeline/feed-rate-limit";
import { parseIcsCalendar } from "@/lib/timeline/ics";
import { diffAgainstExisting, naturalKey } from "@/lib/timeline/ingestion";

const VALID_TOKEN = "a".repeat(43);

describe("parseFeedPath", () => {
  it("accepts <token>.ics with a 43-char base64url token", () => {
    expect(parseFeedPath(`${VALID_TOKEN}.ics`)).toBe(VALID_TOKEN);
    expect(parseFeedPath("AZaz09_-".padEnd(43, "x") + ".ics")).toBe(
      "AZaz09_-".padEnd(43, "x")
    );
  });

  it("rejects a missing .ics extension", () => {
    expect(parseFeedPath(VALID_TOKEN)).toBeNull();
  });

  it("rejects tokens of the wrong length or alphabet", () => {
    expect(parseFeedPath(`${"a".repeat(42)}.ics`)).toBeNull();
    expect(parseFeedPath(`${"a".repeat(44)}.ics`)).toBeNull();
    expect(parseFeedPath(`${"a".repeat(42)}!.ics`)).toBeNull();
    expect(parseFeedPath(`${"a".repeat(42)}=.ics`)).toBeNull();
    expect(parseFeedPath(".ics")).toBeNull();
    expect(parseFeedPath("")).toBeNull();
  });
});

const NOW = new Date("2026-07-18T12:00:00.000Z");

const rows: FeedEventRow[] = [
  {
    startDate: new Date("2026-08-12T00:00:00.000Z"),
    endDate: null,
    title: "Noon Dismissal – Corbett",
    note: "Pickup at 12:00",
  },
  {
    startDate: new Date("2026-11-23T00:00:00.000Z"),
    endDate: new Date("2026-11-28T00:00:00.000Z"),
    title: "Thanksgiving Break",
    note: null,
  },
];

describe("buildFeedIcs", () => {
  it("names a scoped feed after its Calendar Source", () => {
    const ics = buildFeedIcs({ scopeName: "Corbett", events: rows, now: NOW });
    expect(ics).toContain("X-WR-CALNAME:Corbett");
  });

  it("names the whole-timeline feed Household Timeline", () => {
    const ics = buildFeedIcs({ scopeName: null, events: rows, now: NOW });
    expect(ics).toContain(`X-WR-CALNAME:${HOUSEHOLD_FEED_NAME}`);
  });

  it("emits date-only VEVENTs with exclusive DTEND", () => {
    const ics = buildFeedIcs({ scopeName: null, events: rows, now: NOW });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260812");
    expect(ics).toContain("DTEND;VALUE=DATE:20260813");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261123");
    expect(ics).toContain("DTEND;VALUE=DATE:20261128");
  });

  // The #90 acceptance round-trip: the feed's output re-imports through
  // the #55 parser + dedup with zero fresh events — a household that
  // subscribes AND re-imports the same feed never duplicates its year.
  it("round-trips through the #55 importer without dupes", () => {
    const ics = buildFeedIcs({ scopeName: "Corbett", events: rows, now: NOW });
    const parsed = parseIcsCalendar(ics);

    expect(parsed.calendarName).toBe("Corbett");
    expect(parsed.skipped).toBe(0);
    expect(parsed.events).toHaveLength(rows.length);

    const existingKeys = new Set(
      rows.map((row) =>
        naturalKey(row.startDate.toISOString().slice(0, 10), row.title)
      )
    );
    const diff = diffAgainstExisting(parsed.events, existingKeys);
    expect(diff.fresh).toHaveLength(0);
    expect(diff.existing).toBe(rows.length);
    expect(diff.duplicatesInFile).toBe(0);
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("ip", 0)).toBe(true);
    expect(limiter.check("ip", 1)).toBe(true);
    expect(limiter.check("ip", 2)).toBe(true);
    expect(limiter.check("ip", 3)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("ip", 0)).toBe(true);
    expect(limiter.check("ip", 1)).toBe(false);
    expect(limiter.check("ip", 60_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a", 0)).toBe(true);
    expect(limiter.check("b", 0)).toBe(true);
    expect(limiter.check("a", 1)).toBe(false);
  });
});
