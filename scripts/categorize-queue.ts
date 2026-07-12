// CLI for the /categorize-transactions interval batch (ADR-0003).
//
//   node --env-file=.env scripts/categorize-queue.ts status
//   node --env-file=.env scripts/categorize-queue.ts apply <mapping.json>
//
// `status` is read-only. `apply` writes labels + CategoryRules (source
// BATCH) atomically in one transaction; re-running with an empty queue or
// an empty mapping is a no-op. Correction-sourced rules are never
// overwritten, and transactions a human corrected are never relabeled.

import { readFileSync } from "node:fs";
import { PrismaClient, type $Enums } from "@prisma/client";
import {
  groupQueueByMerchant,
  planBatchApplication,
  validateBatchEntries,
} from "../src/lib/categorization/batch.ts";

const prisma = new PrismaClient();

async function loadQueue() {
  const rows = await prisma.feedTransaction.findMany({
    where: {
      cspBucket: "UNCATEGORIZED",
      isTransfer: false,
      amount: { lt: 0 },
    },
    select: { id: true, description: true, amount: true },
    orderBy: { postedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    amountCents: Math.round(Number(row.amount) * 100),
  }));
}

async function status() {
  const queue = await loadQueue();
  console.log(`[categorize-queue] ${queue.length} UNCATEGORIZED money-out transaction(s) in the queue`);
  const groups = groupQueueByMerchant(queue);
  for (const group of groups) {
    console.log(
      `  ${group.pattern}  ×${group.count}  $${(group.totalCents / 100).toFixed(2)}` +
        `  e.g. ${group.samples.join(" | ")}`
    );
  }
  if (queue.length === 0) {
    console.log("[categorize-queue] Queue is empty — nothing to do.");
  }
}

async function apply(mappingPath: string) {
  const raw = JSON.parse(readFileSync(mappingPath, "utf8"));
  const { entries, errors } = validateBatchEntries(raw);
  if (errors.length > 0) {
    console.error("[categorize-queue] Mapping rejected:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const queue = await loadQueue();
  const before = queue.length;
  if (before === 0 && entries.length === 0) {
    console.log("[categorize-queue] Empty queue and empty mapping — no-op.");
    return;
  }

  // The queue spans every household; rules are per-household. Resolve each
  // transaction's household so rules land on the right User.
  const owners = await prisma.feedTransaction.findMany({
    where: { id: { in: queue.map((q) => q.id) } },
    select: {
      id: true,
      linkedAccount: { select: { connection: { select: { userId: true } } } },
    },
  });
  const ownerByTransaction = new Map(
    owners.map((o) => [o.id, o.linkedAccount.connection.userId])
  );
  const userIds = [...new Set(ownerByTransaction.values())];

  let rulesCreated = 0;
  let labelsWritten = 0;
  const skipped = new Set<string>();

  for (const userId of userIds) {
    const userQueue = queue.filter((q) => ownerByTransaction.get(q.id) === userId);
    const existingRules = await prisma.categoryRule.findMany({
      where: { userId },
      select: { merchantPattern: true, source: true },
    });
    const plan = planBatchApplication(userQueue, entries, existingRules);
    plan.skippedCorrectionPatterns.forEach((p) => skipped.add(p));

    // Only write rules for merchants that actually appear in this
    // household's queue — rules are per-household knowledge, not globals.
    const patternsInUse = new Set(plan.labelUpdates.map((u) => u.entry.merchantPattern));
    const ruleWrites = plan.ruleUpserts.filter((e) => patternsInUse.has(e.merchantPattern));

    await prisma.$transaction([
      ...ruleWrites.map((entry) =>
        prisma.categoryRule.upsert({
          where: {
            userId_merchantPattern: { userId, merchantPattern: entry.merchantPattern },
          },
          update: {
            cspBucket: entry.cspBucket as $Enums.CspBucket,
            moneyDial: entry.moneyDial as $Enums.DialCategory | null,
            fixedCostCategory: entry.fixedCostCategory as $Enums.FixedCostCategory | null,
            source: "BATCH",
          },
          create: {
            userId,
            merchantPattern: entry.merchantPattern,
            cspBucket: entry.cspBucket as $Enums.CspBucket,
            moneyDial: entry.moneyDial as $Enums.DialCategory | null,
            fixedCostCategory: entry.fixedCostCategory as $Enums.FixedCostCategory | null,
            source: "BATCH",
          },
        })
      ),
      ...plan.labelUpdates.map((update) =>
        prisma.feedTransaction.update({
          where: { id: update.transactionId },
          data: {
            cspBucket: update.entry.cspBucket as $Enums.CspBucket,
            moneyDial: update.entry.moneyDial as $Enums.DialCategory | null,
            fixedCostCategory: update.entry
              .fixedCostCategory as $Enums.FixedCostCategory | null,
            categorizationSource: "BATCH",
          },
        })
      ),
    ]);
    rulesCreated += ruleWrites.length;
    labelsWritten += plan.labelUpdates.length;
  }

  const after = await prisma.feedTransaction.count({
    where: { cspBucket: "UNCATEGORIZED", isTransfer: false, amount: { lt: 0 } },
  });
  console.log(
    `[categorize-queue] Queue ${before} -> ${after}. ` +
      `${labelsWritten} label(s) written, ${rulesCreated} rule(s) upserted (source BATCH)` +
      (skipped.size > 0
        ? `, ${skipped.size} pattern(s) skipped (owned by Corrections): ${[...skipped].join(", ")}`
        : "")
  );
}

const [command, argument] = process.argv.slice(2);
try {
  if (command === "status") await status();
  else if (command === "apply" && argument) await apply(argument);
  else {
    console.log("Usage: node --env-file=.env scripts/categorize-queue.ts status | apply <mapping.json>");
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
