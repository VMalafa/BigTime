// Dial Drift (CONTEXT.md): a mismatch between a Money Dial's stated
// importance and its actual share of guilt-free spending — the core
// "patterns → optimal outcomes" insight. Pure module; unit-tested.
//
// Copy rules (Honesty Rule): encouragement comes from framing and next
// actions, never from hiding the true state. "Fixable, here's how" — never
// shame words like "overspending".

import { MONEY_DIALS } from "@/lib/constants/money-dials";

/** Below this many dial-categorized guilt-free transactions in the month,
 * the callout is suppressed — too thin to read drift honestly. */
export const DIAL_DRIFT_MIN_TRANSACTIONS = 5;

const DIAL_NAMES = new Map(MONEY_DIALS.map((d) => [d.category as string, d.name]));

export function dialName(dial: string): string {
  return DIAL_NAMES.get(dial) ?? dial;
}

export interface GuiltFreeTransaction {
  /** Signed cents; only money-out counts toward spending. */
  amountCents: number;
  moneyDial: string | null;
}

export interface DialShare {
  /** null = guilt-free spend not yet assigned a Money Dial. */
  dial: string | null;
  actualCents: number;
  /** Share of the month's guilt-free spending, 0-100. */
  sharePercent: number;
}

export interface DialShareBreakdown {
  shares: DialShare[];
  /** Total guilt-free money-out — shares reconcile to exactly this. */
  totalCents: number;
  /** How many transactions carried a Money Dial (drives suppression). */
  dialedTransactionCount: number;
}

/**
 * Actual share of the month's guilt-free spending per Money Dial. Every
 * dial appears (zero rows included); spend without a dial yet is its own
 * `dial: null` row so the breakdown reconciles with the bucket total.
 */
export function computeDialShares(
  transactions: GuiltFreeTransaction[]
): DialShareBreakdown {
  const spend = transactions.filter((t) => t.amountCents < 0);
  const totalCents = spend.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const dialedTransactionCount = spend.filter((t) => t.moneyDial !== null).length;

  const byDial = new Map<string | null, number>();
  for (const dial of MONEY_DIALS) byDial.set(dial.category, 0);
  for (const t of spend) {
    const key = t.moneyDial;
    byDial.set(key, (byDial.get(key) ?? 0) + Math.abs(t.amountCents));
  }

  const shares: DialShare[] = [...byDial.entries()]
    .filter(([dial]) => dial !== null || (byDial.get(null) ?? 0) > 0)
    .map(([dial, actualCents]) => ({
      dial,
      actualCents,
      sharePercent: totalCents > 0 ? (actualCents / totalCents) * 100 : 0,
    }));

  return { shares, totalCents, dialedTransactionCount };
}

export interface DriftCallout {
  dial: string;
  importance: number;
  expectedSharePercent: number;
  actualSharePercent: number;
  direction: "above" | "below";
  /** The one honest sentence naming the mismatch. */
  sentence: string;
  /** The one concrete next action. */
  nextAction: string;
}

/**
 * Picks the single largest importance-vs-share mismatch for the month.
 * Expected share is the dial's stated importance relative to all dials'
 * importance. Returns null (suppressed) when fewer than `minTransactions`
 * dial-categorized guilt-free transactions exist — an honest "too thin to
 * call" rather than a shaky insight.
 */
export function selectDriftCallout(
  breakdown: DialShareBreakdown,
  importanceByDial: Record<string, number>,
  minTransactions: number = DIAL_DRIFT_MIN_TRANSACTIONS
): DriftCallout | null {
  if (breakdown.dialedTransactionCount < minTransactions) return null;
  if (breakdown.totalCents <= 0) return null;

  const levels = MONEY_DIALS.map((d) => ({
    dial: d.category as string,
    importance: importanceByDial[d.category] ?? 5,
  }));
  const importanceTotal = levels.reduce((sum, l) => sum + l.importance, 0);
  if (importanceTotal <= 0) return null;

  // Shares over dialed spend only: the null row is unknown, not drift.
  const dialedTotal = breakdown.shares
    .filter((s) => s.dial !== null)
    .reduce((sum, s) => sum + s.actualCents, 0);
  if (dialedTotal <= 0) return null;

  let best: DriftCallout | null = null;
  for (const { dial, importance } of levels) {
    const expected = (importance / importanceTotal) * 100;
    const actualCents =
      breakdown.shares.find((s) => s.dial === dial)?.actualCents ?? 0;
    const actual = (actualCents / dialedTotal) * 100;
    const drift = Math.abs(actual - expected);
    if (!best || drift > Math.abs(best.actualSharePercent - best.expectedSharePercent)) {
      best = {
        dial,
        importance,
        expectedSharePercent: expected,
        actualSharePercent: actual,
        direction: actual >= expected ? "above" : "below",
        sentence: "",
        nextAction: "",
      };
    }
  }
  if (!best) return null;

  const name = dialName(best.dial);
  const actual = Math.round(best.actualSharePercent);
  const expected = Math.round(best.expectedSharePercent);
  const highestImportance = [...levels].sort((a, b) => b.importance - a.importance)[0];

  if (best.direction === "above") {
    best.sentence =
      `${name} took ${actual}% of this month's guilt-free spending, while its ` +
      `importance to you (${best.importance}/10) suggests closer to ${expected}%. ` +
      `That's drift, not a verdict — and it's fixable.`;
    best.nextAction =
      highestImportance.dial !== best.dial
        ? `Next action: pick a comfortable ${name} number for next month and point the difference at ${dialName(highestImportance.dial)}.`
        : `Next action: decide whether ${name} has earned a higher importance level — or set a comfortable cap for next month.`;
  } else {
    best.sentence =
      `You rate ${name} ${best.importance}/10, but it got just ${actual}% of ` +
      `this month's guilt-free spending (its importance suggests ~${expected}%).`;
    best.nextAction = `Next action: plan one ${name} moment before the month ends — that's what the money is for.`;
  }
  return best;
}
