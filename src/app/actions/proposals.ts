"use server";

// Proposal server actions (CONTEXT.md): the feed drafts, the human ratifies.
// These actions compute Proposals, remember decisions, seed CategoryRules,
// and create mapped Debts. Income confirmation writes its IncomeSource row
// here directly (#49, server-authoritative); fixed-cost confirmation still
// enters via the flow store until #50 converts it.

import type { $Enums } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getActiveProfileId } from "@/lib/active-profile";
import { detectRecurringPatterns } from "@/lib/recurring/pattern-engine";
import {
  buildDebtProposals,
  buildFixedCostProposals,
  buildIncomeProposals,
  type DebtProposal,
  type IncomeProposal,
  type TieredFixedCostProposals,
} from "@/lib/proposals/proposals";
import { isCspBucket } from "@/lib/categorization/corrections";

const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export interface FlowProposals {
  linked: boolean;
  fixedCosts: TieredFixedCostProposals;
  debts: DebtProposal[];
  /** Always individually confirmed — income moves every CSP percentage. */
  income: IncomeProposal[];
}

/** Proposals for the flow's fixed-costs and debts steps. Empty (and
 * `linked: false`) for households with no Linked Accounts. */
export async function getFlowProposals(): Promise<FlowProposals> {
  const empty: FlowProposals = {
    linked: false,
    fixedCosts: { confirmAll: [], individual: [] },
    debts: [],
    income: [],
  };
  const user = await requireUser();
  if (!user) return empty;

  const accounts = await prisma.linkedAccount.findMany({
    where: { connection: { userId: user.id } },
    select: {
      id: true,
      name: true,
      institution: true,
      accountType: true,
      currentBalance: true,
      mappedDebtId: true,
    },
  });
  if (accounts.length === 0) return empty;

  const [transactions, decisions, profiles] = await Promise.all([
    prisma.feedTransaction.findMany({
      where: {
        linkedAccountId: { in: accounts.map((a) => a.id) },
        postedAt: { gte: new Date(Date.now() - LOOKBACK_MS) },
      },
      select: {
        id: true,
        postedAt: true,
        amount: true,
        description: true,
        isTransfer: true,
      },
    }),
    prisma.proposalDecision.findMany({ where: { userId: user.id } }),
    prisma.profile.findMany({
      where: { userId: user.id },
      include: {
        incomeSources: true,
        spendingPlan: { include: { fixedCostLineItems: true } },
      },
    }),
  ]);

  const patterns = detectRecurringPatterns(
    transactions.map((t) => ({
      id: t.id,
      postedAt: t.postedAt,
      amountCents: Math.round(Number(t.amount) * 100),
      description: t.description,
      isTransfer: t.isTransfer,
    }))
  );

  const decidedPatterns = new Set(
    decisions.filter((d) => d.kind === "FIXED_COST").map((d) => d.key)
  );
  const decidedAccounts = new Set(
    decisions.filter((d) => d.kind === "DEBT").map((d) => d.key)
  );
  const decidedIncomePatterns = new Set(
    decisions.filter((d) => d.kind === "INCOME").map((d) => d.key)
  );
  const monthlyIncomeCents = Math.round(
    profiles
      .flatMap((p) => p.incomeSources)
      .reduce((sum, s) => sum + Number(s.monthlyAmount), 0) * 100
  );
  const existingLineItemNames = profiles
    .flatMap((p) => p.spendingPlan?.fixedCostLineItems ?? [])
    .map((i) => i.name);
  const existingIncomeNames = profiles
    .flatMap((p) => p.incomeSources)
    .map((s) => s.name);
  const transactionsById = new Map(
    transactions.map((t) => [
      t.id,
      { postedAt: t.postedAt, amountCents: Math.round(Number(t.amount) * 100) },
    ])
  );

  return {
    linked: true,
    income: buildIncomeProposals(patterns, {
      decidedPatterns: decidedIncomePatterns,
      existingIncomeNames,
      transactionsById,
    }),
    fixedCosts: buildFixedCostProposals(patterns, {
      monthlyIncomeCents,
      decidedPatterns,
      existingLineItemNames,
    }),
    debts: buildDebtProposals(
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        accountType: a.accountType,
        currentBalanceCents: Math.round(Number(a.currentBalance) * 100),
        mapped: a.mappedDebtId !== null,
      })),
      decidedAccounts
    ),
  };
}

export interface FixedCostConfirmation {
  merchantPattern: string;
  fixedCostCategory: string;
}

/**
 * Records fixed-cost Proposal confirmations: remembers the decision and
 * seeds a CategoryRule (source SEED) per merchant so future syncs
 * categorize deterministically. The line item itself is added client-side
 * through the flow store (single persistence path). Never overwrites an
 * existing rule — human Corrections and batch rules outrank seeds.
 */
export async function confirmFixedCostProposals(
  confirmations: FixedCostConfirmation[]
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  for (const confirmation of confirmations) {
    const category = confirmation.fixedCostCategory as $Enums.FixedCostCategory;
    await prisma.proposalDecision.upsert({
      where: {
        userId_kind_key: {
          userId: user.id,
          kind: "FIXED_COST",
          key: confirmation.merchantPattern,
        },
      },
      update: { decision: "CONFIRMED" },
      create: {
        userId: user.id,
        kind: "FIXED_COST",
        key: confirmation.merchantPattern,
        decision: "CONFIRMED",
      },
    });

    const existing = await prisma.categoryRule.findUnique({
      where: {
        userId_merchantPattern: {
          userId: user.id,
          merchantPattern: confirmation.merchantPattern,
        },
      },
    });
    if (!existing && isCspBucket("FIXED_COSTS")) {
      await prisma.categoryRule.create({
        data: {
          userId: user.id,
          merchantPattern: confirmation.merchantPattern,
          cspBucket: "FIXED_COSTS",
          fixedCostCategory: category,
          source: "SEED",
        },
      });
    }
  }
  return { ok: true };
}

/** Remembers an income confirmation; the IncomeSource itself is added
 * client-side through the flow store like typed income, so it feeds the
 * CSP suggested-percent machinery identically. */
export interface ConfirmedIncomeSource {
  id: string;
  name: string;
  monthlyAmount: number;
  isAfterTax: boolean;
}

export async function confirmIncomeProposal(
  merchantPattern: string
): Promise<{ ok?: boolean; incomeSource?: ConfirmedIncomeSource; error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  // Re-derive the Proposal server-side so the created IncomeSource carries
  // feed-derived facts, never client-supplied ones. Since #49 the income row
  // is written here directly (awaited, per-intent) — there is no store flush
  // left to carry it.
  const proposals = await getFlowProposals();
  const proposal = proposals.income.find(
    (p) => p.merchantPattern === merchantPattern
  );
  if (!proposal) return { error: "Income proposal not found." };

  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "No profile found." };

  const [row] = await prisma.$transaction([
    prisma.incomeSource.create({
      data: {
        profileId,
        name: proposal.name,
        monthlyAmount: proposal.monthlyAmountCents / 100,
        isAfterTax: true,
      },
    }),
    prisma.proposalDecision.upsert({
      where: {
        userId_kind_key: {
          userId: user.id,
          kind: "INCOME",
          key: merchantPattern,
        },
      },
      update: { decision: "CONFIRMED" },
      create: {
        userId: user.id,
        kind: "INCOME",
        key: merchantPattern,
        decision: "CONFIRMED",
      },
    }),
  ]);

  return {
    ok: true,
    incomeSource: {
      id: row.id,
      name: row.name,
      monthlyAmount: Number(row.monthlyAmount),
      isAfterTax: row.isAfterTax,
    },
  };
}

/** Remembers a dismissal — the same Proposal is never raised twice. */
export async function dismissProposal(
  kind: "FIXED_COST" | "DEBT" | "INCOME",
  key: string
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  await prisma.proposalDecision.upsert({
    where: { userId_kind_key: { userId: user.id, kind, key } },
    update: { decision: "DISMISSED" },
    create: { userId: user.id, kind, key, decision: "DISMISSED" },
  });
  return { ok: true };
}

export interface DebtConfirmationInput {
  linkedAccountId: string;
  /** The two facts that never ride the feed. */
  apr: number;
  minimumPaymentCents: number;
}

export interface ConfirmedDebt {
  id: string;
  name: string;
  balanceCents: number;
  apr: number;
  minimumPaymentCents: number;
  debtType: string;
  creditLimitCents: number | null;
}

/**
 * Confirms a Debt Proposal: creates the Debt on the default Profile, maps
 * the Linked Account to it (the feed owns the balance from now on), and
 * remembers the decision. Returns the created Debt so the flow store can
 * mirror it client-side.
 */
export async function confirmDebtProposal(
  input: DebtConfirmationInput
): Promise<{ debt?: ConfirmedDebt; error?: string }> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  const account = await prisma.linkedAccount.findFirst({
    where: { id: input.linkedAccountId, connection: { userId: user.id } },
  });
  if (!account) return { error: "Linked Account not found." };
  if (account.mappedDebtId) return { error: "Already mapped to a Debt." };
  if (!Number.isFinite(input.apr) || input.apr < 0 || input.apr > 100) {
    return { error: "Enter an APR between 0 and 100." };
  }
  if (!Number.isFinite(input.minimumPaymentCents) || input.minimumPaymentCents < 0) {
    return { error: "Enter a valid minimum payment." };
  }

  const profile =
    (await prisma.profile.findFirst({
      where: { userId: user.id, isDefault: true },
    })) ?? (await prisma.profile.findFirst({ where: { userId: user.id } }));
  if (!profile) return { error: "No profile found for this household." };

  const debtType =
    account.accountType === "CREDIT_CARD" ? "CREDIT_CARD" : "PERSONAL_LOAN";
  const balance = Math.abs(Number(account.currentBalance));

  const debt = await prisma.debt.create({
    data: {
      profileId: profile.id,
      name: account.name,
      balance,
      apr: input.apr,
      minimumPayment: input.minimumPaymentCents / 100,
      debtType,
    },
  });
  await prisma.linkedAccount.update({
    where: { id: account.id },
    data: { mappedDebtId: debt.id },
  });
  await prisma.proposalDecision.upsert({
    where: {
      userId_kind_key: { userId: user.id, kind: "DEBT", key: account.id },
    },
    update: { decision: "CONFIRMED" },
    create: {
      userId: user.id,
      kind: "DEBT",
      key: account.id,
      decision: "CONFIRMED",
    },
  });

  return {
    debt: {
      id: debt.id,
      name: debt.name,
      balanceCents: Math.round(balance * 100),
      apr: input.apr,
      minimumPaymentCents: input.minimumPaymentCents,
      debtType,
      creditLimitCents: null,
    },
  };
}
