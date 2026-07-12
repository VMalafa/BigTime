// Applies the deterministic Categorization layers (ADR-0003) to a
// household's feed transactions. Runs during every sync and from the
// backfill script — zero AI or network calls, by design.

import type { $Enums, PrismaClient } from "@prisma/client";
import {
  categorizeTransaction,
  pairTransfers,
  type AccountContext,
  type Categorization,
  type LineItemInput,
  type RuleInput,
  type TransactionInput,
} from "./deterministic.ts";

/** How far back each run re-examines transactions. */
const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

export interface CategorizationRunResult {
  transferPairs: number;
  categorized: {
    mappedDebt: number;
    fixedCostMatch: number;
    rule: number;
  };
}

const INSTALLMENT_PAYMENT_CATEGORIZATION: Categorization = {
  cspBucket: "FIXED_COSTS",
  moneyDial: null,
  fixedCostCategory: "DEBT_MINIMUMS",
  source: "MAPPED_DEBT",
};

/**
 * One deterministic pass for one household (User): pair Transfers first,
 * then categorize the remaining UNCATEGORIZED transactions via mapped-Debt
 * accounts, known fixed-cost line items, and the CategoryRule table.
 * Corrections and batch labels are never overwritten.
 */
export async function applyDeterministicCategorization(
  prisma: PrismaClient,
  userId: string
): Promise<CategorizationRunResult> {
  const accounts = await prisma.linkedAccount.findMany({
    where: { connection: { userId } },
    select: {
      id: true,
      accountType: true,
      mappedDebt: { select: { debtType: true } },
    },
  });
  const accountsById = new Map<string, AccountContext>(
    accounts.map((a) => [
      a.id,
      {
        id: a.id,
        accountType: a.accountType,
        mappedDebtType: a.mappedDebt?.debtType ?? null,
      },
    ])
  );

  const rules: RuleInput[] = (
    await prisma.categoryRule.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    })
  ).map((r) => ({
    merchantPattern: r.merchantPattern,
    cspBucket: r.cspBucket,
    moneyDial: r.moneyDial,
    fixedCostCategory: r.fixedCostCategory,
  }));

  const lineItems: LineItemInput[] = (
    await prisma.fixedCostLineItem.findMany({
      where: { spendingPlan: { profile: { userId } } },
      select: { name: true, category: true },
    })
  ).map((i) => ({ name: i.name, category: i.category }));

  const rows = await prisma.feedTransaction.findMany({
    where: {
      linkedAccountId: { in: [...accountsById.keys()] },
      postedAt: { gte: new Date(Date.now() - LOOKBACK_MS) },
    },
    select: {
      id: true,
      linkedAccountId: true,
      amount: true,
      postedAt: true,
      description: true,
      cspBucket: true,
      isTransfer: true,
      transferPairId: true,
    },
  });

  const transactions: TransactionInput[] = rows.map((row) => ({
    id: row.id,
    linkedAccountId: row.linkedAccountId,
    amountCents: Math.round(Number(row.amount) * 100),
    postedAt: row.postedAt,
    description: row.description,
    cspBucket: row.cspBucket,
    isTransfer: row.isTransfer,
    transferPairId: row.transferPairId,
  }));
  const byId = new Map(transactions.map((t) => [t.id, t]));

  const result: CategorizationRunResult = {
    transferPairs: 0,
    categorized: { mappedDebt: 0, fixedCostMatch: 0, rule: 0 },
  };

  // --- Transfer pairing first: paired legs leave the spending/income pool.
  const pairs = pairTransfers(transactions, accountsById);
  for (const pair of pairs) {
    const outLeg = byId.get(pair.outLegId);
    const inLeg = byId.get(pair.inLegId);
    if (!outLeg || !inLeg) continue;

    // The loan-side leg of an installment payment is excluded as a Transfer;
    // the paying-side leg is the household's real fixed cost.
    const outLegIsTransfer = pair.kind === "TRANSFER";
    const outLegCategorization =
      pair.kind === "INSTALLMENT_PAYMENT" &&
      outLeg.cspBucket === "UNCATEGORIZED"
        ? INSTALLMENT_PAYMENT_CATEGORIZATION
        : null;

    await prisma.$transaction([
      prisma.feedTransaction.update({
        where: { id: outLeg.id },
        data: {
          isTransfer: outLegIsTransfer,
          transferPairId: inLeg.id,
          ...(outLegCategorization
            ? {
                cspBucket: outLegCategorization.cspBucket,
                fixedCostCategory:
                  outLegCategorization.fixedCostCategory as $Enums.FixedCostCategory | null,
                categorizationSource: outLegCategorization.source,
              }
            : {}),
        },
      }),
      prisma.feedTransaction.update({
        where: { id: inLeg.id },
        data: { isTransfer: true, transferPairId: outLeg.id },
      }),
    ]);

    outLeg.isTransfer = outLegIsTransfer;
    outLeg.transferPairId = inLeg.id;
    if (outLegCategorization) {
      outLeg.cspBucket = outLegCategorization.cspBucket;
      result.categorized.mappedDebt++;
    }
    inLeg.isTransfer = true;
    inLeg.transferPairId = outLeg.id;
    result.transferPairs++;
  }

  // --- Deterministic layers over what remains uncategorized and unpaired.
  for (const transaction of transactions) {
    const account = accountsById.get(transaction.linkedAccountId);
    if (!account) continue;
    const categorization = categorizeTransaction(
      transaction,
      account,
      rules,
      lineItems
    );
    if (!categorization) continue;

    await prisma.feedTransaction.update({
      where: { id: transaction.id },
      data: {
        cspBucket: categorization.cspBucket,
        moneyDial: categorization.moneyDial as $Enums.DialCategory | null,
        fixedCostCategory:
          categorization.fixedCostCategory as $Enums.FixedCostCategory | null,
        categorizationSource: categorization.source,
      },
    });
    if (categorization.source === "MAPPED_DEBT") result.categorized.mappedDebt++;
    else if (categorization.source === "FIXED_COST_MATCH")
      result.categorized.fixedCostMatch++;
    else result.categorized.rule++;
  }

  return result;
}
