// The heartbeat's persisted detection half (#109): the expensive scans
// over the 180-day Transaction window — paycheck filtering against the
// confirmed income streams and recurring-charge pattern detection — run
// here, at sync time, never on the per-view path. The feed only changes
// via syncs (daily cron or manual refresh), so recomputing at every sync
// keeps the snapshot exactly as fresh as the feed itself. Home's read
// revives it with one cheap query; a household with no snapshot yet
// (never synced — e.g. the seeded e2e fixtures) computes live instead.

import { prisma } from "@/lib/prisma";
import {
  filterPaycheckDeposits,
  type DepositInput,
} from "@/lib/heartbeat/pay-period";
import {
  detectRecurringPatterns,
  type RecurringPattern,
} from "@/lib/recurring/pattern-engine";

const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

export interface HeartbeatDetection {
  paychecks: { deposit: DepositInput; streamPattern: string }[];
  chargePatterns: RecurringPattern[];
}

/** The detection pass itself — shared by the sync-time refresh and the
 * live fallback in getHeartbeat. */
export async function computeHeartbeatDetection(
  userId: string,
  confirmedStreamPatterns: string[]
): Promise<HeartbeatDetection> {
  const transactions = await prisma.feedTransaction.findMany({
    where: {
      linkedAccount: { connection: { userId } },
      postedAt: { gte: new Date(Date.now() - LOOKBACK_MS) },
      isTransfer: false,
    },
    select: {
      id: true,
      postedAt: true,
      amount: true,
      description: true,
      isTransfer: true,
    },
  });

  const paychecks = filterPaycheckDeposits(
    transactions
      .filter((t) => Number(t.amount) > 0)
      .map((t) => ({
        postedAt: t.postedAt,
        amountCents: Math.round(Number(t.amount) * 100),
        description: t.description,
      })),
    confirmedStreamPatterns
  );

  const chargePatterns = detectRecurringPatterns(
    transactions.map((t) => ({
      id: t.id,
      postedAt: t.postedAt,
      amountCents: Math.round(Number(t.amount) * 100),
      description: t.description,
      isTransfer: t.isTransfer,
    }))
  );

  return { paychecks, chargePatterns };
}

/** Recompute and persist the household's snapshot. Runs after every sync;
 * never throws into the sync path (a failed snapshot only means the next
 * Home read computes live). */
export async function refreshHeartbeatSnapshot(userId: string): Promise<void> {
  const confirmedStreams = await prisma.proposalDecision.findMany({
    where: { userId, kind: "INCOME", decision: "CONFIRMED" },
    select: { key: true },
  });
  if (confirmedStreams.length === 0) {
    // No confirmed stream = the heartbeat runs on manual fuel; a stale
    // snapshot must not linger into the day a stream gets confirmed.
    await prisma.heartbeatSnapshot.deleteMany({ where: { userId } });
    return;
  }

  const detection = await computeHeartbeatDetection(
    userId,
    confirmedStreams.map((s) => s.key)
  );

  const paychecks = detection.paychecks.map((p) => ({
    deposit: {
      postedAt: p.deposit.postedAt.toISOString(),
      amountCents: p.deposit.amountCents,
      description: p.deposit.description,
    },
    streamPattern: p.streamPattern,
  }));
  const chargePatterns = detection.chargePatterns.map((c) => ({
    ...c,
    firstSeen: c.firstSeen.toISOString(),
    lastSeen: c.lastSeen.toISOString(),
  }));

  await prisma.heartbeatSnapshot.upsert({
    where: { userId },
    update: { paychecks, chargePatterns, computedAt: new Date() },
    create: { userId, paychecks, chargePatterns },
  });
}

/** The persisted detection, dates revived — or null when no snapshot
 * exists (the household has never synced). */
export async function readHeartbeatSnapshot(
  userId: string
): Promise<HeartbeatDetection | null> {
  const row = await prisma.heartbeatSnapshot.findUnique({
    where: { userId },
  });
  if (!row) return null;

  const paychecks = (
    row.paychecks as {
      deposit: { postedAt: string; amountCents: number; description: string };
      streamPattern: string;
    }[]
  ).map((p) => ({
    deposit: {
      postedAt: new Date(p.deposit.postedAt),
      amountCents: p.deposit.amountCents,
      description: p.deposit.description,
    },
    streamPattern: p.streamPattern,
  }));
  const chargePatterns = (
    row.chargePatterns as (Omit<RecurringPattern, "firstSeen" | "lastSeen"> & {
      firstSeen: string;
      lastSeen: string;
    })[]
  ).map((c) => ({
    ...c,
    firstSeen: new Date(c.firstSeen),
    lastSeen: new Date(c.lastSeen),
  }));

  return { paychecks, chargePatterns };
}
