// The renewal radar (#70, ratified in #65): no new surface, no cleverness
// beyond dates and two styling moments. A renewal is an Event with the
// "renewal" category; this module owns (1) deriving draft renewals from
// annual/semi-annual feed charge patterns, and (2) the lead-time state a
// renewal Event is in — quiet from 30 days out, escalated at 7 days
// unhandled, quiet again the moment it's handled.

import type { RecurringPattern } from "@/lib/recurring/pattern-engine";

export const RENEWAL_CATEGORY = "renewal";
export const FEED_DERIVED_SOURCE_NAME = "Feed-derived";

const RENEWAL_CADENCE_GAP_DAYS: Partial<Record<string, number>> = {
  SEMI_ANNUAL: 183,
  ANNUAL: 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_DAYS = 30;
const ESCALATION_WINDOW_DAYS = 7;

export interface RenewalDraft {
  /** "Acme Insurance renewal" — title-cased merchant. */
  title: string;
  /** Date-only ISO: the pattern's next occurrence after `now`. */
  date: string;
  costCents: number;
}

function titleCase(merchantPattern: string): string {
  return merchantPattern
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Feed-derived renewal drafts: an annual or semi-annual recurring charge
 * implies next term's renewal date. Pure — the caller lands these as
 * DRAFT Events (never auto-confirmed) with natural-key dedup, so a
 * re-derivation raises nothing new and a dismissal stays dismissed.
 */
export function deriveRenewalDrafts(
  patterns: RecurringPattern[],
  now: Date
): RenewalDraft[] {
  const drafts: RenewalDraft[] = [];
  for (const pattern of patterns) {
    if (pattern.direction !== "charge") continue;
    const gapDays = RENEWAL_CADENCE_GAP_DAYS[pattern.cadence];
    if (!gapDays) continue;

    let next = new Date(
      Date.UTC(
        pattern.lastSeen.getUTCFullYear(),
        pattern.lastSeen.getUTCMonth(),
        pattern.lastSeen.getUTCDate()
      )
    );
    while (next.getTime() <= now.getTime()) {
      next = new Date(next.getTime() + gapDays * DAY_MS);
    }

    drafts.push({
      title: `${titleCase(pattern.merchantPattern)} renewal`,
      date: next.toISOString().slice(0, 10),
      costCents: pattern.typicalAmountCents,
    });
  }
  return drafts.sort((a, b) => a.date.localeCompare(b.date));
}

export type RenewalState = "FUTURE" | "UPCOMING" | "ESCALATED" | "HANDLED";

export interface RenewalEventInput {
  id: string;
  /** Date-only ISO. */
  date: string;
  category: string;
  handledAt: string | null;
}

export function isRenewalEvent(event: { category: string }): boolean {
  return event.category === RENEWAL_CATEGORY;
}

function daysUntil(dateIso: string, todayIso: string): number {
  return Math.round(
    (new Date(`${dateIso}T00:00:00.000Z`).getTime() -
      new Date(`${todayIso}T00:00:00.000Z`).getTime()) /
      DAY_MS
  );
}

/** One renewal's lead-time state. Handled always wins. */
export function renewalState(
  event: RenewalEventInput,
  todayIso: string
): RenewalState {
  if (!isRenewalEvent(event)) return "FUTURE";
  if (event.handledAt !== null) return "HANDLED";
  const days = daysUntil(event.date, todayIso);
  if (days <= ESCALATION_WINDOW_DAYS) return "ESCALATED";
  if (days <= UPCOMING_WINDOW_DAYS) return "UPCOMING";
  return "FUTURE";
}

/**
 * No red-alert stacking: when several renewals escalate at once, only the
 * soonest one goes loud — the rest hold the quiet upcoming style until
 * it's handled.
 */
export function pickLoudRenewal(
  events: RenewalEventInput[],
  todayIso: string
): string | null {
  const escalated = events
    .filter((e) => renewalState(e, todayIso) === "ESCALATED")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return escalated[0]?.id ?? null;
}

export function renewalDetail(
  event: RenewalEventInput,
  todayIso: string
): string | null {
  const state = renewalState(event, todayIso);
  const days = daysUntil(event.date, todayIso);
  switch (state) {
    case "ESCALATED":
      return days <= 0
        ? "Renewal date reached — handle it or dismiss it."
        : `Renews in ${days} day${days === 1 ? "" : "s"} — handle it or it stays loud.`;
    case "UPCOMING":
      return `Upcoming renewal · ${days} days out`;
    case "HANDLED":
      return "Handled ✓";
    default:
      return null;
  }
}
