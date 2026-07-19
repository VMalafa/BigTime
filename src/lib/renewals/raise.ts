// Feed-derived renewal drafts (#70): the radar builds itself. Runs on the
// review-surface load — idempotent (natural-key dedup; dismissals stay
// dismissed), so re-running is free of side effects. Annual patterns need
// two occurrences ~a year apart, hence the long lookback (the heartbeat's
// 180-day window can never see them).

import { prisma } from "@/lib/prisma";
import { detectRecurringPatterns } from "@/lib/recurring/pattern-engine";
import { landDrafts } from "@/lib/ingestion/land-drafts";
import {
  deriveRenewalDrafts,
  FEED_DERIVED_SOURCE_NAME,
  RENEWAL_CATEGORY,
} from "@/lib/renewals/radar";

const LOOKBACK_MS = 800 * 24 * 60 * 60 * 1000;

export async function raiseFeedRenewalDrafts(
  userId: string,
  now: Date
): Promise<{ created: number }> {
  const transactions = await prisma.feedTransaction.findMany({
    where: {
      linkedAccount: { connection: { userId } },
      postedAt: { gte: new Date(now.getTime() - LOOKBACK_MS) },
      isTransfer: false,
      amount: { lt: 0 },
    },
    select: { id: true, postedAt: true, amount: true, description: true },
  });
  if (transactions.length === 0) return { created: 0 };

  const patterns = detectRecurringPatterns(
    transactions.map((t) => ({
      id: t.id,
      postedAt: t.postedAt,
      amountCents: Math.round(Number(t.amount) * 100),
      description: t.description,
      isTransfer: false,
    }))
  );
  const drafts = deriveRenewalDrafts(patterns, now);
  if (drafts.length === 0) return { created: 0 };

  const landed = await landDrafts(
    userId,
    {
      name: FEED_DERIVED_SOURCE_NAME,
      kind: "FEED_DERIVED",
      categories: [RENEWAL_CATEGORY],
    },
    drafts.map((d) => ({
      startDate: d.date,
      title: d.title,
      category: RENEWAL_CATEGORY,
      costCents: d.costCents,
    }))
  );
  return { created: landed.created };
}
