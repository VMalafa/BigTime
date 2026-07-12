// One-off / re-runnable backfill: applies the deterministic Categorization
// layers (ADR-0003) to every household's existing feed transactions.
// Idempotent — pairing and categorization skip anything already labeled.
//
// Usage: node --env-file=.env scripts/categorize-backfill.ts

import { PrismaClient } from "@prisma/client";
import { applyDeterministicCategorization } from "../src/lib/categorization/apply.ts";

const prisma = new PrismaClient();

const users = await prisma.user.findMany({ select: { id: true } });
console.log(`[categorize-backfill] ${users.length} household(s)`);

for (const user of users) {
  const result = await applyDeterministicCategorization(prisma, user.id);
  console.log(
    `[categorize-backfill] household ${user.id.slice(0, 8)}…: ` +
      `${result.transferPairs} Transfer pair(s), ` +
      `${result.categorized.mappedDebt} mapped-debt, ` +
      `${result.categorized.fixedCostMatch} fixed-cost, ` +
      `${result.categorized.rule} rule categorization(s)`
  );
}

const remaining = await prisma.feedTransaction.count({
  where: { cspBucket: "UNCATEGORIZED", isTransfer: false },
});
console.log(
  `[categorize-backfill] done — ${remaining} transaction(s) remain UNCATEGORIZED (visible per the Honesty Rule; the interval batch handles the residue)`
);

await prisma.$disconnect();
