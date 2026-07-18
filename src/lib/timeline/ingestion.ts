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

export interface TierableDraft {
  startDate: string;
  endDate?: string | null;
}

/**
 * Tier a source's drafts for review. The deterministic ICS path only
 * distrusts ranges; the AI-extraction path (#57) additionally routes
 * same-day siblings (the model may have wrongly split or merged them) and
 * anything the caller flags for attention (e.g. below the extraction
 * confidence floor) to individual review. Year-boundary spans are ranges,
 * so the range rule already catches them.
 */
export function partitionDraftTiers<T extends TierableDraft>(
  drafts: T[],
  options: {
    siblingsToIndividual?: boolean;
    needsAttention?: (draft: T) => boolean;
  } = {}
): { confirmAll: T[]; individual: T[] } {
  const dateCounts = new Map<string, number>();
  for (const draft of drafts) {
    dateCounts.set(draft.startDate, (dateCounts.get(draft.startDate) ?? 0) + 1);
  }

  const confirmAll: T[] = [];
  const individual: T[] = [];
  for (const draft of drafts) {
    const sibling =
      options.siblingsToIndividual === true &&
      (dateCounts.get(draft.startDate) ?? 0) > 1;
    if (draft.endDate || sibling || options.needsAttention?.(draft)) {
      individual.push(draft);
    } else {
      confirmAll.push(draft);
    }
  }
  return { confirmAll, individual };
}
