// Import tiering + re-import dedup for Calendar Sources (#55).
//
// Ratification reuses the tiered Proposal UX: clear-cut single-day events
// bundle into confirm-all; multi-day ranges ask individually (an exclusive
// end is exactly where transcription mistakes live — see the ingestion
// research's failure-mode catalog). The ICS path is deterministic, so
// shape, not model confidence, decides the tier.

import { normalizeEventTitle } from "@/lib/timeline/natural-key";
import type { ParsedIcsEvent } from "@/lib/timeline/ics";

/** The Event natural key (#54), as a comparable string. */
export function naturalKey(startDate: string, title: string): string {
  return `${startDate}|${normalizeEventTitle(title)}`;
}

export interface ImportDiff {
  /** Not seen before — these become DRAFT Events. */
  fresh: ParsedIcsEvent[];
  /** Natural key already exists (confirmed, draft, or dismissed) — a
   * re-import never re-raises them. */
  existing: number;
  /** Duplicates within the file itself (same natural key twice). */
  duplicatesInFile: number;
}

export function diffAgainstExisting(
  parsed: ParsedIcsEvent[],
  existingKeys: ReadonlySet<string>
): ImportDiff {
  const fresh: ParsedIcsEvent[] = [];
  const seen = new Set<string>();
  let existing = 0;
  let duplicatesInFile = 0;

  for (const event of parsed) {
    const key = naturalKey(event.startDate, event.title);
    if (existingKeys.has(key)) {
      existing++;
      continue;
    }
    if (seen.has(key)) {
      duplicatesInFile++;
      continue;
    }
    seen.add(key);
    fresh.push(event);
  }

  return { fresh, existing, duplicatesInFile };
}

/** Confirm-all tier: explicit single-day. Individual tier: multi-day. */
export function isConfirmAllTier(event: { endDate?: string | null }): boolean {
  return !event.endDate;
}
