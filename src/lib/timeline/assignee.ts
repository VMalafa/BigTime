// Event assignees (#72): who's got it — a Profile, or one of the two
// fixed extras a household actually hands events to. Pure vocabulary +
// filter predicate so the stream and the actions share one definition.

export const EXTRA_ASSIGNEES = [
  { id: "SITTER", name: "Sitter" },
  { id: "EXTENDED_DAY", name: "Extended Day" },
] as const;

export type ExtraAssignee = (typeof EXTRA_ASSIGNEES)[number]["id"];

export function isExtraAssignee(value: string): value is ExtraAssignee {
  return EXTRA_ASSIGNEES.some((extra) => extra.id === value);
}

export function extraAssigneeName(extra: ExtraAssignee): string {
  return EXTRA_ASSIGNEES.find((e) => e.id === extra)!.name;
}

/** The chip text for an Event's assignee; null = unassigned, no chip. */
export function assigneeChipLabel(event: {
  profileName: string | null;
  assigneeExtra: ExtraAssignee | null;
}): string | null {
  if (event.profileName) return event.profileName;
  if (event.assigneeExtra) return extraAssigneeName(event.assigneeExtra);
  return null;
}

/**
 * The person filter (#56, extended by #72): filter values are "ALL", a
 * Profile id, or an extra's id. Unassigned Events are household-wide and
 * pass every filter.
 */
export function matchesPersonFilter(
  filter: string,
  event: { profileId: string | null; assigneeExtra: ExtraAssignee | null }
): boolean {
  if (filter === "ALL") return true;
  if (event.profileId === null && event.assigneeExtra === null) return true;
  if (event.profileId !== null) return event.profileId === filter;
  return event.assigneeExtra === filter;
}
