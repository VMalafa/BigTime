"use server";

// Correction server action (CONTEXT.md): reassigning a Transaction's
// Categorization inline. Never a one-off — it writes a CategoryRule
// (source: CORRECTION) and recategorizes that merchant's transactions past
// (here) and future (the deterministic rule layer on every sync).

import { revalidatePath } from "next/cache";
import type { $Enums } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  deriveMerchantPattern,
  matchesMerchantPattern,
  resolveCorrection,
  type CorrectionInput,
} from "@/lib/categorization/corrections";

export interface CorrectionResult {
  ok?: boolean;
  error?: string;
  /** How many other transactions of the same merchant were recategorized. */
  retroactivelyRecategorized?: number;
}

export async function correctTransaction(
  transactionId: string,
  input: CorrectionInput
): Promise<CorrectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const transaction = await prisma.feedTransaction.findFirst({
    where: {
      id: transactionId,
      linkedAccount: { connection: { userId: user.id } },
    },
    select: {
      id: true,
      description: true,
      isTransfer: true,
      transferPairId: true,
    },
  });
  if (!transaction) return { error: "Transaction not found." };

  const correction = resolveCorrection(input);
  if (correction.kind === "invalid") return { error: correction.reason };

  // --- "This is a Transfer": exclude it; no merchant rule (Transfers are
  // account-shape, not merchant-shape).
  if (correction.kind === "mark-transfer") {
    await prisma.feedTransaction.update({
      where: { id: transaction.id },
      data: {
        isTransfer: true,
        cspBucket: "UNCATEGORIZED",
        moneyDial: null,
        fixedCostCategory: null,
        categorizationSource: "CORRECTION",
      },
    });
    revalidatePath("/dashboard/spending");
    return { ok: true, retroactivelyRecategorized: 0 };
  }

  const data = {
    cspBucket: correction.cspBucket as $Enums.CspBucket,
    moneyDial: correction.moneyDial as $Enums.DialCategory | null,
    fixedCostCategory:
      correction.fixedCostCategory as $Enums.FixedCostCategory | null,
  };

  // --- Transfer misdetection: correcting a Transfer to a real category
  // un-pairs both legs; the counterpart leg goes back to the spending pool
  // as UNCATEGORIZED (visible, per the Honesty Rule).
  if (transaction.isTransfer || transaction.transferPairId) {
    if (transaction.transferPairId) {
      await prisma.feedTransaction.updateMany({
        where: {
          id: transaction.transferPairId,
          linkedAccount: { connection: { userId: user.id } },
        },
        data: { isTransfer: false, transferPairId: null },
      });
    }
  }

  await prisma.feedTransaction.update({
    where: { id: transaction.id },
    data: {
      ...data,
      isTransfer: false,
      transferPairId: null,
      categorizationSource: "CORRECTION",
    },
  });

  // --- The Correction becomes a standing rule for this merchant.
  const merchantPattern = deriveMerchantPattern(transaction.description);
  if (merchantPattern.length >= 2) {
    await prisma.categoryRule.upsert({
      where: {
        userId_merchantPattern: { userId: user.id, merchantPattern },
      },
      update: { ...data, source: "CORRECTION" },
      create: {
        userId: user.id,
        merchantPattern,
        ...data,
        source: "CORRECTION",
      },
    });
  }

  // --- Retroactive: recategorize this merchant's other transactions.
  // Prior human Corrections and Transfers are left alone.
  let retroactivelyRecategorized = 0;
  if (merchantPattern.length >= 2) {
    const candidates = await prisma.feedTransaction.findMany({
      where: {
        linkedAccount: { connection: { userId: user.id } },
        id: { not: transaction.id },
        isTransfer: false,
        NOT: { categorizationSource: "CORRECTION" },
      },
      select: { id: true, description: true },
    });
    const matchIds = candidates
      .filter((c) => matchesMerchantPattern(c.description, merchantPattern))
      .map((c) => c.id);
    if (matchIds.length > 0) {
      const updated = await prisma.feedTransaction.updateMany({
        where: { id: { in: matchIds } },
        data: { ...data, categorizationSource: "RULE" },
      });
      retroactivelyRecategorized = updated.count;
    }
  }

  revalidatePath("/dashboard/spending");
  return { ok: true, retroactivelyRecategorized };
}
