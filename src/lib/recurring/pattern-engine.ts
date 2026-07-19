// Recurring-pattern engine over FeedTransactions (pure computation, no UI,
// no I/O). Detects recurring charges and deposits by merchant-normalized
// description, classifies cadence, and scores confidence so clear cadences
// are distinguishable from coincidences. Feeds Proposals and, later, Pay
// Periods.

// Relative import (not the @ alias) so Node-run scripts can import this
// module directly, matching src/lib/categorization conventions.
import { normalizeMerchant } from "../categorization/deterministic.ts";

export type Cadence =
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMI_MONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUAL";

export interface RecurringTransactionInput {
  id: string;
  postedAt: Date;
  /** Signed cents; negative = charge, positive = deposit. */
  amountCents: number;
  description: string;
  isTransfer: boolean;
}

export interface RecurringPattern {
  merchantPattern: string;
  direction: "charge" | "deposit";
  cadence: Cadence;
  /** Median absolute amount across the pattern's occurrences. */
  typicalAmountCents: number;
  /** Observed spread (median absolute deviation) around the typical amount. */
  amountToleranceCents: number;
  occurrences: number;
  /** 0..1 — gap consistency, amount consistency, and occurrence count. */
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  transactionIds: string[];
}

export interface DetectOptions {
  /** Patterns below this confidence are dropped (coincidence guard). */
  minConfidence?: number;
}

export const DEFAULT_MIN_CONFIDENCE = 0.55;

/** Amounts join an existing cluster within max(30%, $20) of its median —
 * wide enough for utility drift, narrow enough not to swallow a merchant's
 * unrelated purchases. */
const AMOUNT_TOLERANCE_RELATIVE = 0.3;
const AMOUNT_TOLERANCE_ABSOLUTE_CENTS = 2000;

const DAY_MS = 24 * 60 * 60 * 1000;

interface CadenceSpec {
  cadence: Cadence;
  expectedGapDays: number;
  minGapDays: number;
  maxGapDays: number;
  /** Occurrences needed for full count confidence. */
  fullCount: number;
  minOccurrences: number;
}

const CADENCE_SPECS: CadenceSpec[] = [
  { cadence: "WEEKLY", expectedGapDays: 7, minGapDays: 5.5, maxGapDays: 8.5, fullCount: 6, minOccurrences: 4 },
  { cadence: "BIWEEKLY", expectedGapDays: 14, minGapDays: 12, maxGapDays: 17, fullCount: 5, minOccurrences: 3 },
  { cadence: "MONTHLY", expectedGapDays: 30.4, minGapDays: 26, maxGapDays: 35, fullCount: 4, minOccurrences: 3 },
  { cadence: "QUARTERLY", expectedGapDays: 91.3, minGapDays: 80, maxGapDays: 105, fullCount: 3, minOccurrences: 3 },
  { cadence: "SEMI_ANNUAL", expectedGapDays: 182.6, minGapDays: 160, maxGapDays: 210, fullCount: 3, minOccurrences: 2 },
  { cadence: "ANNUAL", expectedGapDays: 365.25, minGapDays: 330, maxGapDays: 400, fullCount: 2, minOccurrences: 2 },
];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function medianAbsoluteDeviation(values: number[], center: number): number {
  return median(values.map((v) => Math.abs(v - center)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Greedy amount clustering: drifting bills stay together; a merchant's
 * unrelated purchases fall into separate clusters. */
function clusterByAmount(
  transactions: RecurringTransactionInput[]
): RecurringTransactionInput[][] {
  const sorted = [...transactions].sort(
    (a, b) => Math.abs(a.amountCents) - Math.abs(b.amountCents)
  );
  const clusters: { members: RecurringTransactionInput[]; amounts: number[] }[] = [];
  for (const transaction of sorted) {
    const amount = Math.abs(transaction.amountCents);
    const host = clusters.find((cluster) => {
      const center = median(cluster.amounts);
      const tolerance = Math.max(
        center * AMOUNT_TOLERANCE_RELATIVE,
        AMOUNT_TOLERANCE_ABSOLUTE_CENTS
      );
      return Math.abs(amount - center) <= tolerance;
    });
    if (host) {
      host.members.push(transaction);
      host.amounts.push(amount);
    } else {
      clusters.push({ members: [transaction], amounts: [amount] });
    }
  }
  return clusters.map((c) => c.members);
}

/** Day gaps between consecutive occurrences, same-day duplicates collapsed. */
function dayGaps(dates: Date[]): number[] {
  const days = [...new Set(dates.map((d) => Math.floor(d.getTime() / DAY_MS)))].sort(
    (a, b) => a - b
  );
  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
  return gaps;
}

/** Semi-monthly (1st/15th-style) posts on ~two fixed days of the month;
 * biweekly drifts across the calendar. */
function looksSemiMonthly(dates: Date[]): boolean {
  const daysOfMonth = dates.map((d) => d.getUTCDate());
  const centers: number[] = [];
  for (const day of daysOfMonth) {
    if (!centers.some((c) => Math.abs(c - day) <= 2 || Math.abs(c - day) >= 26)) {
      centers.push(day);
    }
  }
  return centers.length <= 2;
}

function classifyCadence(dates: Date[]): {
  spec: CadenceSpec;
  gapScore: number;
} | null {
  const gaps = dayGaps(dates);
  if (gaps.length === 0) return null;
  const medianGap = median(gaps);

  let spec = CADENCE_SPECS.find(
    (s) => medianGap >= s.minGapDays && medianGap <= s.maxGapDays
  );
  if (!spec) return null;
  if (spec.cadence === "BIWEEKLY" && looksSemiMonthly(dates)) {
    spec = { ...spec, cadence: "SEMI_MONTHLY", expectedGapDays: 15.2 };
  }
  if (dates.length < spec.minOccurrences) return null;

  const deviation = medianAbsoluteDeviation(gaps, spec.expectedGapDays);
  const gapScore = clamp01(1 - deviation / (0.25 * spec.expectedGapDays));
  if (gapScore <= 0) return null;
  return { spec, gapScore };
}

/**
 * Detects recurring patterns across a household's feed transactions.
 * Transfers are excluded; charges and deposits are analyzed separately.
 * Results are sorted by confidence, highest first.
 */
export function detectRecurringPatterns(
  transactions: RecurringTransactionInput[],
  options: DetectOptions = {}
): RecurringPattern[] {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  const groups = new Map<string, RecurringTransactionInput[]>();
  for (const transaction of transactions) {
    if (transaction.isTransfer || transaction.amountCents === 0) continue;
    const pattern = normalizeMerchant(transaction.description);
    if (pattern.length < 2) continue;
    const direction = transaction.amountCents < 0 ? "charge" : "deposit";
    const key = `${direction}:${pattern}`;
    const group = groups.get(key) ?? [];
    group.push(transaction);
    groups.set(key, group);
  }

  const patterns: RecurringPattern[] = [];
  for (const [key, group] of groups) {
    const [direction, merchantPattern] = [
      key.slice(0, key.indexOf(":")) as "charge" | "deposit",
      key.slice(key.indexOf(":") + 1),
    ];
    for (const cluster of clusterByAmount(group)) {
      if (cluster.length < 2) continue;
      const dates = cluster.map((t) => t.postedAt);
      const classified = classifyCadence(dates);
      if (!classified) continue;

      const amounts = cluster.map((t) => Math.abs(t.amountCents));
      const typical = median(amounts);
      const amountSpread = medianAbsoluteDeviation(amounts, typical);
      const amountScore =
        typical > 0 ? clamp01(1 - amountSpread / (0.3 * typical)) : 0;
      const countScore = clamp01(cluster.length / classified.spec.fullCount);

      const confidence =
        0.5 * classified.gapScore + 0.25 * amountScore + 0.25 * countScore;
      if (confidence < minConfidence) continue;

      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      patterns.push({
        merchantPattern,
        direction,
        cadence: classified.spec.cadence,
        typicalAmountCents: Math.round(typical),
        amountToleranceCents: Math.round(amountSpread),
        occurrences: cluster.length,
        confidence: Math.round(confidence * 1000) / 1000,
        firstSeen: sortedDates[0],
        lastSeen: sortedDates[sortedDates.length - 1],
        transactionIds: cluster.map((t) => t.id),
      });
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}
