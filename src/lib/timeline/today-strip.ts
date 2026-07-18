// The Today strip (#79): today's and tomorrow's actionable rows — school
// Events with their person chip, Earmark due dates in covered-by-default
// tone. Pure selection + labeling so the Home action just feeds it.
//
// "School quirk" v1 (flagged for ratification on #79): the trivially-
// knowable case is the Event's own category naming a day anomaly —
// dismissals, closures, holidays, breaks. Per-source vocabularies are
// free-form, so this is a keyword read, not a taxonomy; the deferred
// derived-coverage engine (#40/#43) owns anything smarter.

import type { ExtraAssignee } from "@/lib/timeline/assignee";
import { assigneeChipLabel } from "@/lib/timeline/assignee";

const QUIRK_PATTERN =
  /dismissal|holiday|break|closed|closure|no school|half.?day|early release/i;

export function isSchoolQuirkCategory(category: string): boolean {
  return QUIRK_PATTERN.test(category);
}

export interface StripEventInput {
  id: string;
  /** Date-only ISO. */
  date: string;
  /** Exclusive end; null = single-day. */
  endDate: string | null;
  title: string;
  category: string;
  costCents: number | null;
  profileName: string | null;
  assigneeExtra: ExtraAssignee | null;
}

export interface StripEarmarkInput {
  name: string;
  amountCents: number;
  /** Date-only ISO. */
  dueDate: string;
  funded: boolean;
  shortfallCents: number;
}

export type StripDay = "TODAY" | "TOMORROW";

export interface TodayStripRow {
  day: StripDay;
  kind: "EVENT" | "EARMARK";
  title: string;
  /** Person chip label; null with needsPickup=false = plain row. */
  chip: string | null;
  /** Quirk Event with nobody on it: the sharpest ball on the screen. */
  needsPickup: boolean;
  costCents: number | null;
  /** Earmark tone line: calm when covered, loud only when not. */
  detail: string | null;
  funded: boolean | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Does a date-only Event (exclusive end) cover the given day? */
function coversDay(event: StripEventInput, dayIso: string): boolean {
  if (event.endDate === null) return event.date === dayIso;
  return event.date <= dayIso && dayIso < event.endDate;
}

/**
 * "Today · Fri, Jul 18". The optional context suffix is the travel-domain
 * seam ("you're in Denver, home +2h") — deferred, ships date-only.
 */
export function stripDayLabel(
  day: StripDay,
  dateIso: string,
  contextSuffix?: string
): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }
  );
  const base = `${day === "TODAY" ? "Today" : "Tomorrow"} · ${date}`;
  return contextSuffix ? `${base} · ${contextSuffix}` : base;
}

export interface TodayStrip {
  rows: TodayStripRow[];
  /** The first unassigned quirk in the window, for Weather targeting. */
  unassignedQuirk: { title: string; date: string } | null;
}

export function buildTodayStrip(input: {
  /** CONFIRMED Events near the window (the action pre-filters loosely). */
  events: StripEventInput[];
  /** Current-period Earmarks with funded state (fundEarmarks output). */
  earmarks: StripEarmarkInput[];
  todayIso: string;
}): TodayStrip {
  const tomorrowIso = addDays(input.todayIso, 1);
  const days: { day: StripDay; iso: string }[] = [
    { day: "TODAY", iso: input.todayIso },
    { day: "TOMORROW", iso: tomorrowIso },
  ];

  const rows: TodayStripRow[] = [];
  let unassignedQuirk: { title: string; date: string } | null = null;
  const seenEvents = new Set<string>();

  for (const { day, iso } of days) {
    for (const event of input.events) {
      // A multi-day Event renders once, on its first day in the window.
      if (!coversDay(event, iso) || seenEvents.has(event.id)) continue;
      seenEvents.add(event.id);

      const chip = assigneeChipLabel(event);
      const needsPickup = chip === null && isSchoolQuirkCategory(event.category);
      if (needsPickup && unassignedQuirk === null) {
        unassignedQuirk = { title: event.title, date: iso };
      }
      rows.push({
        day,
        kind: "EVENT",
        title: event.title,
        chip,
        needsPickup,
        costCents: event.costCents,
        detail: null,
        funded: null,
      });
    }

    for (const earmark of input.earmarks) {
      if (earmark.dueDate !== iso) continue;
      rows.push({
        day,
        kind: "EARMARK",
        title: earmark.name,
        chip: null,
        needsPickup: false,
        costCents: earmark.amountCents,
        detail: earmark.funded
          ? "Covered — settled rhythm."
          : `This paycheck comes up ${formatDollars(earmark.shortfallCents)} short.`,
        funded: earmark.funded,
      });
    }
  }

  return { rows, unassignedQuirk };
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
