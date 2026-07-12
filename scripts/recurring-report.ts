// Read-only validation of the recurring-pattern engine against the
// household's real feed history (default 180 days).
//
//   node --env-file=.env scripts/recurring-report.ts

import { PrismaClient } from "@prisma/client";
import { detectRecurringPatterns } from "../src/lib/recurring/pattern-engine.ts";

const LOOKBACK_DAYS = 180;
const prisma = new PrismaClient();

const rows = await prisma.feedTransaction.findMany({
  where: {
    postedAt: {
      gte: new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  select: {
    id: true,
    postedAt: true,
    amount: true,
    description: true,
    isTransfer: true,
  },
});

const patterns = detectRecurringPatterns(
  rows.map((row) => ({
    id: row.id,
    postedAt: row.postedAt,
    amountCents: Math.round(Number(row.amount) * 100),
    description: row.description,
    isTransfer: row.isTransfer,
  }))
);

console.log(
  `[recurring-report] ${patterns.length} recurring pattern(s) across ${rows.length} transactions (${LOOKBACK_DAYS}d)`
);
for (const p of patterns) {
  console.log(
    `  ${p.direction === "deposit" ? "+" : "-"} ${p.cadence.padEnd(12)} ` +
      `$${(p.typicalAmountCents / 100).toFixed(2).padStart(9)} ±$${(p.amountToleranceCents / 100).toFixed(2)}` +
      `  ×${p.occurrences}  conf ${p.confidence.toFixed(2)}  last ${p.lastSeen.toISOString().slice(0, 10)}` +
      `  ${p.merchantPattern.slice(0, 60)}`
  );
}

await prisma.$disconnect();
