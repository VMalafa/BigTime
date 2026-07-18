// Natural-key normalization for Event re-import dedup (#54).
//
// An Event's natural key is (calendarSourceId, startDate, normalized title):
// schools reissue calendars ("UPDATED 6/3/26"), and the same event must not
// duplicate just because the reissue tweaked casing, spacing, or
// punctuation. The normalized form is stored on the row
// (Event.normalizedTitle) and enforced unique by the database.

/**
 * Normalize an Event title for the natural key: lowercase, every run of
 * non-alphanumeric characters (punctuation, dashes, ampersands, extra
 * whitespace) collapsed to a single space, trimmed.
 *
 * "Noon Dismissal – PreK3, PreK4 & Kindergarten only"
 *   -> "noon dismissal prek3 prek4 kindergarten only"
 */
export function normalizeEventTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
