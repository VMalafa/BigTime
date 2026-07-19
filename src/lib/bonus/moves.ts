// Planned → moved → verified (#89): a confirmed Moment's move list, the
// Transfer-matching that closes the loop, and the one quiet line for a
// move still unmade after a week. Never a nag — one line, gently.

export interface PlannedMove {
  id: string;
  amountCents: number;
  status: "PLANNED" | "DONE";
  /** Where the money is headed, in the household's words ("Hawaii"). */
  label: string;
  createdAt: Date;
}

export interface TransferLegInput {
  id: string;
  postedAt: Date;
  /** Signed cents as the feed reports them. */
  amountCents: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MoveMatch {
  moveId: string;
  transactionId: string;
}

/**
 * Match PLANNED moves to detected Transfer legs by exact amount, posted on
 * or after the move was planned (one day of posting-date slack). Each leg
 * verifies at most one move; earliest-posted legs match first so re-runs
 * are deterministic.
 */
export function matchMovesToTransfers(
  moves: PlannedMove[],
  transferLegs: TransferLegInput[],
  now: Date
): MoveMatch[] {
  const matches: MoveMatch[] = [];
  const usedLegs = new Set<string>();
  const legs = [...transferLegs].sort(
    (a, b) => a.postedAt.getTime() - b.postedAt.getTime()
  );

  for (const move of moves) {
    if (move.status !== "PLANNED") continue;
    const leg = legs.find(
      (l) =>
        !usedLegs.has(l.id) &&
        Math.abs(l.amountCents) === move.amountCents &&
        l.postedAt.getTime() >= move.createdAt.getTime() - DAY_MS &&
        l.postedAt.getTime() <= now.getTime() + DAY_MS
    );
    if (!leg) continue;
    usedLegs.add(leg.id);
    matches.push({ moveId: move.id, transactionId: leg.id });
  }
  return matches;
}

/** A move waits this long before the one quiet line appears. */
export const MOVE_REMINDER_DAYS = 7;

function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

/**
 * One line, never a nag: the oldest PLANNED move older than a week.
 * Returns null while everything is either done or still fresh.
 */
export function buildMoveReminder(
  moves: PlannedMove[],
  now: Date
): string | null {
  const cutoff = now.getTime() - MOVE_REMINDER_DAYS * DAY_MS;
  const overdue = moves
    .filter((m) => m.status === "PLANNED" && m.createdAt.getTime() <= cutoff)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (overdue.length === 0) return null;
  const move = overdue[0];
  return `Still planning to move ${dollars(move.amountCents)} to ${move.label}?`;
}
