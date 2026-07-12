// Proposals (CONTEXT.md): feed-derived draft entries awaiting ratification —
// never plan data until confirmed. Clear-cut Proposals are bundled into a
// single confirm-all; only ambiguous or plan-moving ones (odd cadences,
// outsized amounts) ask for individual attention. The feed drafts, the
// human ratifies. Pure module — no Prisma, no I/O.

import type { Cadence, RecurringPattern } from "../recurring/pattern-engine.ts";

/** Confidence below which a fixed-cost Proposal needs individual attention. */
export const CONFIRM_ALL_MIN_CONFIDENCE = 0.75;
/** A monthly amount above this share of monthly income is plan-moving. */
export const PLAN_MOVING_INCOME_SHARE = 0.15;

const MONTHS_PER_CADENCE: Record<Cadence, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  ANNUAL: 1 / 12,
};

/** Occurrences-per-month factor -> monthly equivalent for the plan. */
export function monthlyAmountCents(pattern: RecurringPattern): number {
  return Math.round(pattern.typicalAmountCents * MONTHS_PER_CADENCE[pattern.cadence]);
}

const CATEGORY_KEYWORDS: [string, string][] = [
  ["MTG", "HOUSING"],
  ["MORTGAGE", "HOUSING"],
  ["RENT", "HOUSING"],
  ["APARTMENT", "HOUSING"],
  ["HOA", "HOUSING"],
  ["INSURANCE", "INSURANCE"],
  ["GEICO", "INSURANCE"],
  ["ELECTRIC", "UTILITIES"],
  ["UTILIT", "UTILITIES"],
  ["GAS", "UTILITIES"],
  ["WATER", "UTILITIES"],
  ["INTERNET", "UTILITIES"],
  ["COMMUNI", "UTILITIES"],
  ["WIRELESS", "UTILITIES"],
  ["AUTO", "TRANSPORTATION"],
  ["CAR ", "TRANSPORTATION"],
  ["STUDENT LN", "DEBT_MINIMUMS"],
  ["LOAN", "DEBT_MINIMUMS"],
  ["INTEREST CHARGE", "DEBT_MINIMUMS"],
  ["AFFIRM", "DEBT_MINIMUMS"],
  ["MEMBERSHIP", "SUBSCRIPTIONS"],
  ["SUBSCR", "SUBSCRIPTIONS"],
  ["NETFLIX", "SUBSCRIPTIONS"],
  ["SPOTIFY", "SUBSCRIPTIONS"],
  ["HULU", "SUBSCRIPTIONS"],
];

/** Best-guess FixedCostCategory from the merchant pattern; OTHER when unclear. */
export function guessFixedCostCategory(merchantPattern: string): string {
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (merchantPattern.includes(keyword)) return category;
  }
  return "OTHER";
}

export interface FixedCostProposal {
  /** Stable Proposal key — the merchant pattern the rule will use. */
  merchantPattern: string;
  /** Human-friendly name for the line item. */
  name: string;
  cadence: Cadence;
  monthlyAmountCents: number;
  fixedCostCategory: string;
  confidence: number;
  /** Why this Proposal asks for individual attention (null = confirm-all). */
  individualReason: string | null;
}

export interface TieredFixedCostProposals {
  confirmAll: FixedCostProposal[];
  individual: FixedCostProposal[];
}

function titleCase(pattern: string): string {
  return pattern
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fixed-cost Proposals from recurring charge patterns, tiered per the
 * Proposal glossary entry: clear-cut ones bundle under one confirm-all;
 * ambiguous (lower-confidence) or plan-moving (odd cadence, outsized
 * amount) ones ask individually. Already-decided patterns are excluded —
 * a dismissal is remembered.
 */
export function buildFixedCostProposals(
  patterns: RecurringPattern[],
  options: {
    monthlyIncomeCents: number;
    decidedPatterns: Set<string>;
    existingLineItemNames: string[];
  }
): TieredFixedCostProposals {
  const existing = options.existingLineItemNames.map((n) => n.toUpperCase());
  const confirmAll: FixedCostProposal[] = [];
  const individual: FixedCostProposal[] = [];

  for (const pattern of patterns) {
    if (pattern.direction !== "charge") continue;
    if (options.decidedPatterns.has(pattern.merchantPattern)) continue;
    // Already on the plan (e.g. typed manually) — nothing to propose.
    if (existing.some((name) => pattern.merchantPattern.includes(name))) continue;

    const monthly = monthlyAmountCents(pattern);
    const proposal: FixedCostProposal = {
      merchantPattern: pattern.merchantPattern,
      name: titleCase(pattern.merchantPattern),
      cadence: pattern.cadence,
      monthlyAmountCents: monthly,
      fixedCostCategory: guessFixedCostCategory(pattern.merchantPattern),
      confidence: pattern.confidence,
      individualReason: null,
    };

    if (pattern.confidence < CONFIRM_ALL_MIN_CONFIDENCE) {
      proposal.individualReason = "The cadence isn't clear-cut yet.";
    } else if (pattern.cadence === "QUARTERLY" || pattern.cadence === "ANNUAL") {
      proposal.individualReason =
        "An odd cadence for a monthly plan — check the monthly equivalent.";
    } else if (
      options.monthlyIncomeCents > 0 &&
      monthly > options.monthlyIncomeCents * PLAN_MOVING_INCOME_SHARE
    ) {
      proposal.individualReason =
        "Big enough to move the plan — worth a direct look.";
    }

    (proposal.individualReason ? individual : confirmAll).push(proposal);
  }

  const byAmountDesc = (a: FixedCostProposal, b: FixedCostProposal) =>
    b.monthlyAmountCents - a.monthlyAmountCents;
  confirmAll.sort(byAmountDesc);
  individual.sort(byAmountDesc);
  return { confirmAll, individual };
}

/** Income needs this much pattern confidence — reimbursement-style one-off
 * or coincidental deposits never become Proposals. */
export const INCOME_MIN_CONFIDENCE = 0.7;
/** And at least this many observed deposits. */
export const INCOME_MIN_OCCURRENCES = 3;

export interface IncomeEvidenceItem {
  postedAt: Date;
  amountCents: number;
}

export interface IncomeProposal {
  /** Stable Proposal key — the deposit stream's merchant pattern. */
  merchantPattern: string;
  name: string;
  cadence: Cadence;
  typicalAmountCents: number;
  monthlyAmountCents: number;
  confidence: number;
  occurrences: number;
  /** The deposit-stream evidence: most recent occurrences, newest first. */
  evidence: IncomeEvidenceItem[];
}

/**
 * Income Proposals from paycheck-like deposit streams. Income always sits
 * in the individual-attention tier (it moves every CSP percentage) — this
 * builder returns a flat list and there is deliberately no confirm-all
 * shape for it. The confidence + occurrence gate keeps reimbursement-style
 * deposits out.
 */
export function buildIncomeProposals(
  patterns: RecurringPattern[],
  options: {
    decidedPatterns: Set<string>;
    existingIncomeNames: string[];
    /** Occurrence lookup for evidence (postedAt/amount per transaction id). */
    transactionsById: Map<string, IncomeEvidenceItem>;
  }
): IncomeProposal[] {
  const existing = options.existingIncomeNames.map((n) => n.toUpperCase());
  const proposals: IncomeProposal[] = [];

  for (const pattern of patterns) {
    if (pattern.direction !== "deposit") continue;
    if (pattern.confidence < INCOME_MIN_CONFIDENCE) continue;
    if (pattern.occurrences < INCOME_MIN_OCCURRENCES) continue;
    if (options.decidedPatterns.has(pattern.merchantPattern)) continue;
    if (existing.some((name) => pattern.merchantPattern.includes(name))) continue;

    const evidence = pattern.transactionIds
      .map((id) => options.transactionsById.get(id))
      .filter((item): item is IncomeEvidenceItem => item !== undefined)
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
      .slice(0, 4);

    proposals.push({
      merchantPattern: pattern.merchantPattern,
      name: titleCase(pattern.merchantPattern),
      cadence: pattern.cadence,
      typicalAmountCents: pattern.typicalAmountCents,
      monthlyAmountCents: monthlyAmountCents(pattern),
      confidence: pattern.confidence,
      occurrences: pattern.occurrences,
      evidence,
    });
  }

  return proposals.sort((a, b) => b.monthlyAmountCents - a.monthlyAmountCents);
}

export interface DebtProposalAccount {
  id: string;
  name: string;
  institution: string;
  accountType: string;
  currentBalanceCents: number;
  mapped: boolean;
}

export interface DebtProposal {
  /** Stable Proposal key — the LinkedAccount id. */
  linkedAccountId: string;
  name: string;
  institution: string;
  balanceCents: number;
  /** DebtType the account shape implies. */
  suggestedDebtType: string;
}

/**
 * Debt Proposals from CREDIT_CARD/LOAN Linked Accounts not yet mapped to a
 * Debt. The feed owns name and balance; only APR and minimum payment need
 * a human (they never ride the feed).
 */
export function buildDebtProposals(
  accounts: DebtProposalAccount[],
  decidedAccountIds: Set<string>
): DebtProposal[] {
  return accounts
    .filter(
      (account) =>
        (account.accountType === "CREDIT_CARD" || account.accountType === "LOAN") &&
        !account.mapped &&
        !decidedAccountIds.has(account.id)
    )
    .map((account) => ({
      linkedAccountId: account.id,
      name: account.name,
      institution: account.institution,
      balanceCents: Math.abs(account.currentBalanceCents),
      suggestedDebtType:
        account.accountType === "CREDIT_CARD" ? "CREDIT_CARD" : "PERSONAL_LOAN",
    }));
}
