// Deterministic Categorization layers (ADR-0003).
//
// Pipeline order: (1) Mapping-derived (mapped Debt accounts) and known
// fixed-cost line items, (2) the per-household CategoryRule table. The AI
// layer deliberately does not run in the app — anything unmatched stays
// UNCATEGORIZED and visible, per the Honesty Rule.
//
// This module is pure (no Prisma, no I/O) so every layer and the Transfer
// pairing tolerance window can be unit-tested directly.

export type CspBucket =
  | "UNCATEGORIZED"
  | "FIXED_COSTS"
  | "SAVINGS"
  | "INVESTMENTS"
  | "GUILT_FREE";

export type DeterministicSource = "MAPPED_DEBT" | "FIXED_COST_MATCH" | "RULE";

export interface Categorization {
  cspBucket: CspBucket;
  moneyDial: string | null;
  fixedCostCategory: string | null;
  source: DeterministicSource;
}

export interface AccountContext {
  id: string;
  /** LinkedAccountType */
  accountType: string;
  /** DebtType of the mapped Debt, or null when the account is not mapped. */
  mappedDebtType: string | null;
}

export interface TransactionInput {
  id: string;
  linkedAccountId: string;
  /** Signed cents; negative = money out. */
  amountCents: number;
  postedAt: Date;
  description: string;
  cspBucket: string;
  isTransfer: boolean;
  transferPairId: string | null;
}

export interface RuleInput {
  merchantPattern: string;
  cspBucket: CspBucket;
  moneyDial: string | null;
  fixedCostCategory: string | null;
}

export interface LineItemInput {
  name: string;
  /** FixedCostCategory */
  category: string;
}

/**
 * Two legs of a credit-card payment can post days apart. Opposite-amount
 * transactions across the household's own Linked Accounts pair as a Transfer
 * only when they post within this window of each other.
 */
export const TRANSFER_PAIRING_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

/** Installment debts: the payment itself is the household's real fixed cost. */
const INSTALLMENT_DEBT_TYPES = new Set([
  "PERSONAL_LOAN",
  "STUDENT_LOAN",
  "AUTO_LOAN",
  "MORTGAGE",
  "MEDICAL",
  "OTHER_INSTALLMENT",
]);

export function isInstallmentDebtType(debtType: string | null): boolean {
  return debtType !== null && INSTALLMENT_DEBT_TYPES.has(debtType);
}

/**
 * Normalizes a merchant description or pattern for matching: uppercase,
 * punctuation and digits collapsed to single spaces. `SQ *COFFEE 4821`
 * becomes `SQ COFFEE`.
 */
export function normalizeMerchant(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim();
}

export type TransferPairKind = "TRANSFER" | "INSTALLMENT_PAYMENT";

export interface TransferPair {
  /** The money-out leg (negative amount). */
  outLegId: string;
  /** The money-in leg (positive amount). */
  inLegId: string;
  kind: TransferPairKind;
}

/**
 * Detects Transfers: opposite-amount pairs posting near in time across two
 * different Linked Accounts of the same household. Greedy nearest-in-time
 * matching; each transaction joins at most one pair; already-paired
 * transactions are never re-paired.
 *
 * When the money-in leg lands on an account mapped to an installment Debt,
 * the pair is an INSTALLMENT_PAYMENT: the money-out leg is the household's
 * real fixed cost (categorized by the caller), and only the loan-side leg is
 * excluded as a Transfer. Plain pairs (credit-card payments, savings sweeps)
 * exclude both legs.
 */
export function pairTransfers(
  transactions: TransactionInput[],
  accountsById: Map<string, AccountContext>
): TransferPair[] {
  const unpaired = transactions.filter(
    (t) => !t.isTransfer && t.transferPairId === null && t.amountCents !== 0
  );
  const outLegs = unpaired
    .filter((t) => t.amountCents < 0)
    .sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
  const inLegs = unpaired.filter((t) => t.amountCents > 0);

  const claimed = new Set<string>();
  const pairs: TransferPair[] = [];

  for (const outLeg of outLegs) {
    let best: TransactionInput | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const inLeg of inLegs) {
      if (claimed.has(inLeg.id)) continue;
      if (inLeg.linkedAccountId === outLeg.linkedAccountId) continue;
      if (inLeg.amountCents !== -outLeg.amountCents) continue;
      const delta = Math.abs(
        inLeg.postedAt.getTime() - outLeg.postedAt.getTime()
      );
      if (delta > TRANSFER_PAIRING_WINDOW_MS) continue;
      if (delta < bestDelta) {
        best = inLeg;
        bestDelta = delta;
      }
    }
    if (!best) continue;
    claimed.add(best.id);

    const inAccount = accountsById.get(best.linkedAccountId);
    pairs.push({
      outLegId: outLeg.id,
      inLegId: best.id,
      kind: isInstallmentDebtType(inAccount?.mappedDebtType ?? null)
        ? "INSTALLMENT_PAYMENT"
        : "TRANSFER",
    });
  }
  return pairs;
}

/**
 * Layer 1a — Mapping-derived: every transaction on an account mapped to an
 * installment Debt is that debt's payment or interest, a fixed cost by
 * definition. Revolving (credit-card) accounts are NOT categorized here:
 * purchases are spending at the merchant (rules layer) and payment legs are
 * Transfers.
 */
export function categorizeByMappedDebt(
  account: AccountContext
): Categorization | null {
  if (!isInstallmentDebtType(account.mappedDebtType)) return null;
  return {
    cspBucket: "FIXED_COSTS",
    moneyDial: null,
    fixedCostCategory: "DEBT_MINIMUMS",
    source: "MAPPED_DEBT",
  };
}

/**
 * Layer 1b — known fixed-cost line items: a money-out transaction whose
 * description contains a line item's name is that bill. Names shorter than
 * 3 letters after normalization are skipped as too noisy to match on.
 */
export function categorizeByFixedCostLineItem(
  transaction: TransactionInput,
  lineItems: LineItemInput[]
): Categorization | null {
  if (transaction.amountCents >= 0) return null;
  const description = normalizeMerchant(transaction.description);
  if (!description) return null;
  for (const item of lineItems) {
    const needle = normalizeMerchant(item.name);
    if (needle.length < 3) continue;
    if (description.includes(needle)) {
      return {
        cspBucket: "FIXED_COSTS",
        moneyDial: null,
        fixedCostCategory: item.category,
        source: "FIXED_COST_MATCH",
      };
    }
  }
  return null;
}

/**
 * Layer 2 — the per-household rule table: merchant pattern (normalized
 * substring) -> Categorization. First match wins; callers pass rules in a
 * stable order.
 */
export function categorizeByRule(
  transaction: TransactionInput,
  rules: RuleInput[]
): Categorization | null {
  const description = normalizeMerchant(transaction.description);
  if (!description) return null;
  for (const rule of rules) {
    const needle = normalizeMerchant(rule.merchantPattern);
    if (needle.length < 2) continue;
    if (description.includes(needle)) {
      return {
        cspBucket: rule.cspBucket,
        moneyDial: rule.moneyDial,
        fixedCostCategory: rule.fixedCostCategory,
        source: "RULE",
      };
    }
  }
  return null;
}

/**
 * Runs the deterministic layers in ADR-0003 order over one transaction.
 * Only UNCATEGORIZED, unpaired transactions are eligible — a Correction or
 * batch label is never overwritten, and Transfers are excluded entirely.
 */
export function categorizeTransaction(
  transaction: TransactionInput,
  account: AccountContext,
  rules: RuleInput[],
  lineItems: LineItemInput[]
): Categorization | null {
  if (transaction.cspBucket !== "UNCATEGORIZED") return null;
  if (transaction.isTransfer || transaction.transferPairId !== null) return null;
  return (
    categorizeByMappedDebt(account) ??
    categorizeByFixedCostLineItem(transaction, lineItems) ??
    categorizeByRule(transaction, rules)
  );
}
