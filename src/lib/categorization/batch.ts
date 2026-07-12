// Pure logic for the /categorize-transactions interval batch (ADR-0003).
// The batch runs in the owner's Claude Code environment on the Max
// subscription — zero app API spend. It writes back BOTH labels and
// generalized CategoryRules (source: BATCH) so the deterministic share of
// categorization grows monotonically with every run.

import { normalizeMerchant } from "./deterministic.ts";
import { CORRECTABLE_BUCKETS, type CorrectableBucket } from "./corrections.ts";

const DIAL_CATEGORIES = [
  "TRAVEL",
  "FOOD_DINING",
  "HEALTH_FITNESS",
  "CONVENIENCE",
  "TECHNOLOGY",
  "FASHION",
  "EXPERIENCES",
  "EDUCATION",
  "GIVING",
] as const;

const FIXED_COST_CATEGORY_KEYS = [
  "HOUSING",
  "INSURANCE",
  "UTILITIES",
  "TRANSPORTATION",
  "SUBSCRIPTIONS",
  "DEBT_MINIMUMS",
  "OTHER",
] as const;

export interface BatchEntry {
  merchantPattern: string;
  cspBucket: CorrectableBucket;
  moneyDial: string | null;
  fixedCostCategory: string | null;
}

/**
 * Validates raw mapping JSON (as produced by the skill's categorization
 * step) into normalized batch entries. Invalid entries are rejected with
 * reasons — never silently dropped.
 */
export function validateBatchEntries(raw: unknown): {
  entries: BatchEntry[];
  errors: string[];
} {
  const entries: BatchEntry[] = [];
  const errors: string[] = [];
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)
      ? (raw as { entries: unknown[] }).entries
      : null;
  if (!list) {
    return { entries, errors: ["Mapping must be an array or { entries: [...] }."] };
  }

  const seen = new Set<string>();
  for (const [index, item] of list.entries()) {
    const label = `entry ${index + 1}`;
    if (!item || typeof item !== "object") {
      errors.push(`${label}: not an object`);
      continue;
    }
    const e = item as Record<string, unknown>;
    const pattern = normalizeMerchant(String(e.merchantPattern ?? ""));
    if (pattern.length < 2) {
      errors.push(`${label}: merchantPattern too short after normalization`);
      continue;
    }
    if (seen.has(pattern)) {
      errors.push(`${label}: duplicate merchantPattern "${pattern}"`);
      continue;
    }
    const bucket = e.cspBucket as CorrectableBucket;
    if (!CORRECTABLE_BUCKETS.includes(bucket)) {
      errors.push(
        `${label} ("${pattern}"): cspBucket must be one of ${CORRECTABLE_BUCKETS.join(", ")}`
      );
      continue;
    }
    let moneyDial: string | null = null;
    let fixedCostCategory: string | null = null;
    if (bucket === "GUILT_FREE") {
      const dial = e.moneyDial == null ? null : String(e.moneyDial);
      if (dial !== null && !DIAL_CATEGORIES.includes(dial as (typeof DIAL_CATEGORIES)[number])) {
        errors.push(`${label} ("${pattern}"): unknown moneyDial "${dial}"`);
        continue;
      }
      moneyDial = dial;
    }
    if (bucket === "FIXED_COSTS") {
      const category = e.fixedCostCategory == null ? null : String(e.fixedCostCategory);
      if (
        category !== null &&
        !FIXED_COST_CATEGORY_KEYS.includes(
          category as (typeof FIXED_COST_CATEGORY_KEYS)[number]
        )
      ) {
        errors.push(`${label} ("${pattern}"): unknown fixedCostCategory "${category}"`);
        continue;
      }
      fixedCostCategory = category;
    }
    seen.add(pattern);
    entries.push({ merchantPattern: pattern, cspBucket: bucket, moneyDial, fixedCostCategory });
  }
  return { entries, errors };
}

export interface QueueTransaction {
  id: string;
  description: string;
}

export interface ExistingRule {
  merchantPattern: string;
  source: string;
}

export interface BatchPlan {
  /** Rules to upsert with source BATCH. */
  ruleUpserts: BatchEntry[];
  /** Patterns skipped because a human Correction already owns them. */
  skippedCorrectionPatterns: string[];
  /** Queue transactions to label, each with its winning entry. */
  labelUpdates: { transactionId: string; entry: BatchEntry }[];
  /** Queue transactions no entry matched — they stay UNCATEGORIZED. */
  unmatchedTransactionIds: string[];
}

/**
 * Plans one batch application. Correction-sourced rules are never
 * overwritten (their patterns are skipped entirely); queue transactions the
 * mapping doesn't cover stay honestly UNCATEGORIZED.
 */
export function planBatchApplication(
  queue: QueueTransaction[],
  entries: BatchEntry[],
  existingRules: ExistingRule[]
): BatchPlan {
  const correctionPatterns = new Set(
    existingRules
      .filter((r) => r.source === "CORRECTION")
      .map((r) => normalizeMerchant(r.merchantPattern))
  );

  const ruleUpserts: BatchEntry[] = [];
  const skippedCorrectionPatterns: string[] = [];
  for (const entry of entries) {
    if (correctionPatterns.has(entry.merchantPattern)) {
      skippedCorrectionPatterns.push(entry.merchantPattern);
    } else {
      ruleUpserts.push(entry);
    }
  }

  const labelUpdates: BatchPlan["labelUpdates"] = [];
  const unmatchedTransactionIds: string[] = [];
  for (const transaction of queue) {
    const description = normalizeMerchant(transaction.description);
    const winner = ruleUpserts.find((entry) =>
      description.includes(entry.merchantPattern)
    );
    if (winner) {
      labelUpdates.push({ transactionId: transaction.id, entry: winner });
    } else {
      unmatchedTransactionIds.push(transaction.id);
    }
  }

  return {
    ruleUpserts,
    skippedCorrectionPatterns,
    labelUpdates,
    unmatchedTransactionIds,
  };
}

/** Group the queue by normalized merchant for the status report. */
export function groupQueueByMerchant(
  queue: { id: string; description: string; amountCents: number }[]
): {
  pattern: string;
  count: number;
  totalCents: number;
  samples: string[];
}[] {
  const groups = new Map<
    string,
    { count: number; totalCents: number; samples: string[] }
  >();
  for (const transaction of queue) {
    const pattern = normalizeMerchant(transaction.description) || "(blank)";
    const group = groups.get(pattern) ?? { count: 0, totalCents: 0, samples: [] };
    group.count++;
    group.totalCents += Math.abs(transaction.amountCents);
    if (group.samples.length < 2 && !group.samples.includes(transaction.description)) {
      group.samples.push(transaction.description);
    }
    groups.set(pattern, group);
  }
  return [...groups.entries()]
    .map(([pattern, g]) => ({ pattern, ...g }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
