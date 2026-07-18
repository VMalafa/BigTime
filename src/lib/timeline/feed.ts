// Subscribable feed engine (#90): the pure half of the capability-URL
// route. The route stays thin — path parsing, scope naming, and the
// DB-row → ICS mapping live here so seam-1 unit tests cover them, and the
// ICS bytes themselves come from the proven #58 builder (scheduler parity,
// round-trips the #55 importer).

import {
  buildIcsExport,
  type ExportableEvent,
} from "@/lib/timeline/ics-export";

// 32 random bytes as base64url — exactly 43 chars, no padding. Anything
// else 404s before a database round-trip, so the lookup cost for token
// guessing is flat (no enumeration signal).
const FEED_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The X-WR-CALNAME for a whole-Household-Timeline feed. */
export const HOUSEHOLD_FEED_NAME = "Household Timeline";

/**
 * Extract the token from the route's path segment. The URL must read
 * `<token>.ics` — the extension is part of the contract (some clients
 * refuse to subscribe without it).
 */
export function parseFeedPath(segment: string): string | null {
  if (!segment.toLowerCase().endsWith(".ics")) return null;
  const token = segment.slice(0, -4);
  return FEED_TOKEN_PATTERN.test(token) ? token : null;
}

export interface FeedEventRow {
  startDate: Date;
  endDate: Date | null;
  title: string;
  note: string | null;
}

/** Map CONFIRMED Event rows to the #58 exportable shape (date-only ISO). */
export function toExportableEvents(rows: FeedEventRow[]): ExportableEvent[] {
  return rows.map((row) => ({
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
    title: row.title,
    note: row.note,
  }));
}

/**
 * The feed body: full regeneration on every fetch — that IS how updates
 * propagate to subscribers (no RRULE, no diffing, no cron). The calendar
 * name carries the feed's scope so a re-import of the feed lands on a
 * matching Calendar Source and natural-key dedup does its work.
 */
export function buildFeedIcs(input: {
  /** The scoped Calendar Source's name, or null for the whole timeline. */
  scopeName: string | null;
  events: FeedEventRow[];
  now: Date;
}): string {
  return buildIcsExport({
    calendarName: input.scopeName ?? HOUSEHOLD_FEED_NAME,
    events: toExportableEvents(input.events),
    now: input.now,
  });
}
