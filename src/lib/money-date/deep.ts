// The Money Date deep agenda (#82, ratified in #62): three cards join the
// four beats on the FIRST Date of each calendar month — Dial Drift, the
// CSP tune-up, and the subscription audit. Pure derivations here; the
// cards render them in patterns-not-judgment tone (#46/#37): no red, no
// shame, information only.

import { MONEY_DIALS } from "@/lib/constants/money-dials";
import type { DialShareBreakdown } from "@/lib/spending/dial-drift";
import type { RecurringPattern } from "@/lib/recurring/pattern-engine";
import { guessFixedCostCategory } from "@/lib/proposals/proposals";

/**
 * First Date of the calendar month: no other Date's payday lands earlier
 * in the same month. Month boundaries are UTC date-only.
 */
export function isFirstDateOfMonth(
  periodStartIso: string,
  allPeriodStartsIso: string[]
): boolean {
  const month = periodStartIso.slice(0, 7);
  return !allPeriodStartsIso.some(
    (other) =>
      other.slice(0, 7) === month &&
      other < periodStartIso
  );
}

export interface DialDriftRow {
  category: string;
  name: string;
  /** Stated importance, 1–10. */
  statedLevel: number;
  /** Share of last month's Guilt-Free spending, 0–100. */
  sharePercent: number;
  actualCents: number;
}

export interface DialDriftReview {
  /** Sorted by the gap between stated importance and actual share. */
  rows: DialDriftRow[];
  /** Too few dial-categorized transactions to read honestly. */
  suppressed: boolean;
  totalGuiltFreeCents: number;
}

const DIAL_NAMES = new Map(MONEY_DIALS.map((d) => [d.category as string, d.name]));

export function buildDialDriftReview(
  dials: { category: string; level: number }[],
  breakdown: DialShareBreakdown,
  minTransactions: number
): DialDriftReview {
  const suppressed = breakdown.dialedTransactionCount < minTransactions;
  const shareByDial = new Map(
    breakdown.shares.map((s) => [s.dial, s])
  );
  const rows: DialDriftRow[] = dials
    .map((dial) => {
      const share = shareByDial.get(dial.category);
      return {
        category: dial.category,
        name: DIAL_NAMES.get(dial.category) ?? dial.category,
        statedLevel: dial.level,
        sharePercent: share?.sharePercent ?? 0,
        actualCents: share?.actualCents ?? 0,
      };
    })
    // The interesting gap first: stated importance (as a 0-100 scale)
    // furthest from the actual share.
    .sort(
      (a, b) =>
        Math.abs(b.statedLevel * 10 - b.sharePercent) -
        Math.abs(a.statedLevel * 10 - a.sharePercent)
    );
  return { rows, suppressed, totalGuiltFreeCents: breakdown.totalCents };
}

export interface SubscriptionAuditRow {
  /** Title-cased merchant, e.g. "Netflix Com". */
  merchant: string;
  /** The pattern key (normalized merchant) — stable choice identity. */
  merchantPattern: string;
  typicalAmountCents: number;
  cadence: string;
  occurrences: number;
}

/**
 * The audit list: live recurring charge patterns that read as
 * subscriptions (the Proposals keyword classifier — one vocabulary
 * everywhere). Keep/investigate is the household's call; the app never
 * cancels anything (read-only ethos).
 */
export function buildSubscriptionAudit(
  patterns: RecurringPattern[]
): SubscriptionAuditRow[] {
  return patterns
    .filter(
      (p) =>
        p.direction === "charge" &&
        guessFixedCostCategory(p.merchantPattern.toUpperCase()) === "SUBSCRIPTIONS"
    )
    .map((p) => ({
      merchant: p.merchantPattern
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(" "),
      merchantPattern: p.merchantPattern,
      typicalAmountCents: p.typicalAmountCents,
      cadence: p.cadence,
      occurrences: p.occurrences,
    }))
    .sort((a, b) => b.typicalAmountCents - a.typicalAmountCents);
}

/** The Date's one next action when investigations were chosen. */
export function investigateAction(merchants: string[]): string | null {
  if (merchants.length === 0) return null;
  if (merchants.length === 1) {
    return `Investigate ${merchants[0]} — keep it or let it go, together.`;
  }
  return `Investigate ${merchants.slice(0, -1).join(", ")} and ${merchants[merchants.length - 1]} — keep or let go, together.`;
}
