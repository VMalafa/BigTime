// Money moments for the Household Timeline (#56, tone ratified in #37).
//
// Everything here is derived live from the same engines that power the
// heartbeat — nothing is hardcoded and nothing is ever stored as an Event.
// Covered-by-default: every Earmark due date renders, styled as settled
// rhythm when the heartbeat says it's funded; only a genuinely unfunded
// due date escalates, and then with exactly one next action. Honest both
// ways: calm when truly covered, loud only when not.
//
// The Spotlight Goal's target date belongs on this horizon too, but no
// Goal entity exists in the schema yet — the moment kind is admitted and
// none are emitted until Goals land.

import {
  deriveCurrentPayPeriod,
  type DepositInput,
  type LineItemInput,
} from "@/lib/heartbeat/pay-period";
import { normalizeMerchant } from "@/lib/categorization/deterministic";
import type { RecurringPattern } from "@/lib/recurring/pattern-engine";

const DAY_MS = 24 * 60 * 60 * 1000;

export type MoneyMomentKind =
  | "PAYDAY"
  | "MONEY_DATE"
  | "EARMARK_DUE"
  | "GOAL_TARGET";

export interface MoneyMoment {
  kind: MoneyMomentKind;
  /** Date-only ISO (UTC). */
  date: string;
  title: string;
  detail?: string;
  amountCents?: number;
  /** EARMARK_DUE only. */
  funded?: boolean;
  /** Date-only ISO of the paycheck that covers this due date. */
  coveredBy?: string;
  /** Exactly one next action — present only when unfunded. */
  nextAction?: string;
  /** True when the date is a projection rather than an observed deposit. */
  projected?: boolean;
}

const CADENCE_GAP_DAYS: Record<string, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  SEMI_MONTHLY: 15,
  MONTHLY: 30,
  QUARTERLY: 91,
  ANNUAL: 365,
};

function dayFloor(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

function dayToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function formatDollars(cents: number): string {
  return `$${Math.ceil(cents / 100).toLocaleString("en-US")}`;
}

function formatDay(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface MoneyMomentsInput {
  /** Paycheck deposits (already filtered to confirmed streams). */
  paychecks: { deposit: DepositInput; streamPattern: string }[];
  chargePatterns: RecurringPattern[];
  lineItems: LineItemInput[];
  plan: { savingsPercent: number; investmentsPercent: number } | null;
  now: Date;
  horizonDays: number;
}

export function deriveMoneyMoments(input: MoneyMomentsInput): MoneyMoment[] {
  const { paychecks, chargePatterns, lineItems, plan, now, horizonDays } =
    input;
  const nowDay = dayFloor(now);
  const horizonDay = nowDay + horizonDays;
  const moments: MoneyMoment[] = [];

  const period = deriveCurrentPayPeriod(paychecks, now);

  // --- Projected paydays (per stream, median gap), merged same-day; the
  // Money Date rides each payday as a standing moment.
  const streams = new Map<string, number[]>();
  for (const { deposit, streamPattern } of paychecks) {
    const days = streams.get(streamPattern) ?? [];
    days.push(dayFloor(deposit.postedAt));
    streams.set(streamPattern, days);
  }
  const paydayDays = new Set<number>();
  for (const days of streams.values()) {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((d, i) => d - sorted[i]);
    const gap = Math.max(1, Math.round(median(gaps)) || 14);
    let next = sorted[sorted.length - 1] + gap;
    while (next <= nowDay) next += gap;
    while (next <= horizonDay) {
      paydayDays.add(next);
      next += gap;
    }
  }
  const sortedPaydays = [...paydayDays].sort((a, b) => a - b);
  for (const day of sortedPaydays) {
    moments.push({
      kind: "PAYDAY",
      date: dayToIso(day),
      title: "Payday",
      detail: "Projected from your paycheck rhythm",
      projected: true,
    });
    moments.push({
      kind: "MONEY_DATE",
      date: dayToIso(day),
      title: "Money Date",
      detail: "Ten payday minutes together — always ending on the goal",
      projected: true,
    });
  }

  // --- Earmark due dates across the horizon, from each line item's
  // matching recurring charge pattern (deriveEarmarks' rule, projected
  // beyond the current period).
  interface Due {
    name: string;
    amountCents: number;
    day: number;
  }
  const dues: Due[] = [];
  for (const item of lineItems) {
    const needle = normalizeMerchant(item.name);
    const pattern =
      needle.length >= 3
        ? chargePatterns.find(
            (p) =>
              p.direction === "charge" &&
              (p.merchantPattern.includes(needle) ||
                needle.includes(p.merchantPattern))
          )
        : undefined;
    if (!pattern) continue;

    const gap = CADENCE_GAP_DAYS[pattern.cadence] ?? 30;
    let dueDay = dayFloor(pattern.lastSeen);
    while (dueDay < nowDay) dueDay += gap;
    while (dueDay <= horizonDay) {
      dues.push({
        name: item.name,
        amountCents: pattern.typicalAmountCents,
        day: dueDay,
      });
      dueDay += gap;
    }
  }
  dues.sort((a, b) => a.day - b.day);

  // Funding: dues inside the current Pay Period draw down the current
  // paycheck (after the planned savings/investments share) in due-date
  // order. Dues beyond the period are covered by a future paycheck by
  // default — calm unless the current heartbeat shows a genuine shortfall.
  const plannedShare = plan
    ? (plan.savingsPercent + plan.investmentsPercent) / 100
    : 0;
  let remaining = period
    ? period.paycheckCents - Math.round(period.paycheckCents * plannedShare)
    : null;
  const periodEndDay = period ? dayFloor(period.endExclusive) : null;
  const periodStartDay = period ? dayFloor(period.start) : null;

  for (const due of dues) {
    const inCurrentPeriod =
      periodEndDay !== null && due.day < periodEndDay && remaining !== null;

    if (inCurrentPeriod) {
      const funded = remaining! >= due.amountCents;
      const shortfall = funded ? 0 : due.amountCents - Math.max(0, remaining!);
      remaining = remaining! - due.amountCents;
      moments.push({
        kind: "EARMARK_DUE",
        date: dayToIso(due.day),
        title: due.name,
        amountCents: due.amountCents,
        funded,
        coveredBy: funded ? dayToIso(periodStartDay!) : undefined,
        detail: funded
          ? `Covered by ${formatDay(periodStartDay!)}'s paycheck`
          : `This period's paycheck comes up ${formatDollars(shortfall)} short`,
        nextAction: funded
          ? undefined
          : `Trim guilt-free spending by ${formatDollars(shortfall)} before ${formatDay(due.day)}`,
      });
    } else {
      // Covered-by-default: a future paycheck stands behind it.
      const covering = [...sortedPaydays]
        .reverse()
        .find((payday) => payday <= due.day);
      moments.push({
        kind: "EARMARK_DUE",
        date: dayToIso(due.day),
        title: due.name,
        amountCents: due.amountCents,
        funded: true,
        coveredBy: covering !== undefined ? dayToIso(covering) : undefined,
        detail:
          covering !== undefined
            ? `Covered by ${formatDay(covering)}'s paycheck`
            : "Covered by your next paycheck",
      });
    }
  }

  moments.sort((a, b) => a.date.localeCompare(b.date));
  return moments;
}
