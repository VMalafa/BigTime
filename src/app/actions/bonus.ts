"use server";

// Bonus Plan & Bonus Moment actions (#89, ratified in #63): awaited
// per-intent mutations (#29). Detection is on-read and idempotent (the
// deposit's id is the Moment's natural key — a refetch can never
// double-raise), mirroring Milestones (#86). ADR-0001 stands throughout:
// the app plans and verifies moves; it never moves money.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_BONUS_PLAN,
  splitBonus,
  validateBonusPlan,
  type BonusSplitCents,
  type BonusSplitPercents,
} from "@/lib/bonus/plan";
import {
  detectBonusDeposits,
  typicalPaycheckCents,
} from "@/lib/bonus/detect";
import { goalImpact, payoffImpact, type GoalImpact } from "@/lib/bonus/impact";
import {
  buildMoveReminder,
  matchMovesToTransfers,
  type PlannedMove,
} from "@/lib/bonus/moves";
import { filterPaycheckDeposits } from "@/lib/heartbeat/pay-period";
import { detectRecurringPatterns } from "@/lib/recurring/pattern-engine";
import { goalProgressCents } from "@/lib/goals/engine";
import { calculateBonusNet } from "@/lib/calculations/bonus-tax";

const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;
const TRANSFER_LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;

const PATHS = ["/dashboard", "/dashboard/money-date", "/dashboard/income"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// --- The standing split ---------------------------------------------------

export interface BonusPlanData extends BonusSplitPercents {
  /** False until the household has actively saved a split — the default
   * 70/15/15 stands either way. */
  saved: boolean;
}

async function readPlan(userId: string): Promise<BonusPlanData> {
  const row = await prisma.bonusPlan.findUnique({ where: { userId } });
  return row
    ? {
        debtPercent: row.debtPercent,
        goalPercent: row.goalPercent,
        guiltFreePercent: row.guiltFreePercent,
        saved: true,
      }
    : { ...DEFAULT_BONUS_PLAN, saved: false };
}

export async function getBonusPlan(): Promise<BonusPlanData | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  return readPlan(userId);
}

export async function saveBonusPlan(
  input: BonusSplitPercents
): Promise<{ ok?: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };
  const invalid = validateBonusPlan(input);
  if (invalid) return { error: invalid };

  await prisma.bonusPlan.upsert({
    where: { userId },
    update: {
      debtPercent: input.debtPercent,
      goalPercent: input.goalPercent,
      guiltFreePercent: input.guiltFreePercent,
    },
    create: {
      userId,
      debtPercent: input.debtPercent,
      goalPercent: input.goalPercent,
      guiltFreePercent: input.guiltFreePercent,
    },
  });
  revalidateAll();
  revalidatePath("/dashboard/spending-plan");
  return { ok: true };
}

// --- Targets --------------------------------------------------------------

/** The debt the plan's debt share aims at: highest APR still carrying a
 * balance (avalanche — the payoff engines' default read). */
async function findTargetDebt(userId: string) {
  const debts = await prisma.debt.findMany({
    where: { profile: { userId } },
    select: { id: true, name: true, balance: true, apr: true, minimumPayment: true },
  });
  const carrying = debts
    .map((d) => ({
      id: d.id,
      name: d.name,
      balanceCents: Math.round(Number(d.balance) * 100),
      aprPercent: Number(d.apr),
      minimumPaymentCents: Math.round(Number(d.minimumPayment) * 100),
    }))
    .filter((d) => d.balanceCents > 0)
    .sort((a, b) => b.aprPercent - a.aprPercent);
  return carrying[0] ?? null;
}

async function findSpotlight(userId: string) {
  const row = await prisma.goal.findFirst({
    where: { userId, isSpotlight: true },
    include: { linkedAccount: { select: { currentBalance: true } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    targetCents: row.targetCents,
    progressCents: goalProgressCents({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      targetCents: row.targetCents,
      linkedBalanceCents: row.linkedAccount
        ? Math.round(Number(row.linkedAccount.currentBalance) * 100)
        : null,
      manualCents: row.manualCents,
      isSpotlight: true,
      sliceCents: row.sliceCents,
    }),
  };
}

// --- The glance -----------------------------------------------------------

export interface BonusMomentCard {
  id: string;
  amountCents: number;
  description: string;
  postedAt: string; // date-only ISO
  plan: BonusSplitPercents;
  split: BonusSplitCents;
  targetDebtName: string | null;
  /** Months shaved off the target debt by the debt share; null when there
   * is no target debt or the read would be dishonest. */
  payoffMonthsSaved: number | null;
  goal: (GoalImpact & { name: string; emoji: string | null }) | null;
}

export interface BonusGlance {
  /** One Moment at a time — the oldest deposit first. */
  moment: BonusMomentCard | null;
  /** The ~7-day unmatched-move line (#89): one quiet sentence, never a nag. */
  reminder: string | null;
}

/**
 * Detection + verification on read, then the glance. Idempotent end to
 * end: raising dedupes on the deposit id, matching only flips PLANNED
 * moves to DONE. Resolves its own session — "use server" exports are
 * public endpoints and must never take a caller-supplied userId.
 */
export async function getBonusGlance(): Promise<BonusGlance | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const now = new Date();

  // One pooled connection serves the whole glance (#79's constraint), so
  // every query here is either needed on every load or skipped when its
  // subject is absent.
  const [deposits, confirmedStreams] = await Promise.all([
    prisma.feedTransaction.findMany({
      where: {
        linkedAccount: { connection: { userId } },
        postedAt: { gte: new Date(now.getTime() - LOOKBACK_MS) },
        isTransfer: false,
        amount: { gt: 0 },
      },
      select: { id: true, postedAt: true, amount: true, description: true },
    }),
    prisma.proposalDecision.findMany({
      where: { userId, kind: "INCOME", decision: "CONFIRMED" },
      select: { key: true },
    }),
  ]);

  // 1) Detection (#63's rule): non-recurring, matches no paycheck pattern,
  //    ≥ half the typical confirmed-stream paycheck.
  const depositInputs = deposits.map((t) => ({
    id: t.id,
    postedAt: t.postedAt,
    amountCents: Math.round(Number(t.amount) * 100),
    description: t.description,
    isTransfer: false,
  }));
  const paychecks = filterPaycheckDeposits(
    depositInputs.map((d) => ({
      postedAt: d.postedAt,
      amountCents: d.amountCents,
      description: d.description,
    })),
    confirmedStreams.map((s) => s.key)
  );
  const candidates = detectBonusDeposits({
    deposits: depositInputs,
    confirmedStreamPatterns: confirmedStreams.map((s) => s.key),
    recurringDepositPatterns: detectRecurringPatterns(depositInputs),
    typicalPaycheckCents: typicalPaycheckCents(
      paychecks.map((p) => p.deposit.amountCents)
    ),
  });
  if (candidates.length > 0) {
    await prisma.bonusMoment.createMany({
      data: candidates.map((c) => ({
        userId,
        feedTransactionId: c.feedTransactionId,
        source: "FEED" as const,
        description: c.description,
        postedAt: c.postedAt,
        amountCents: c.amountCents,
      })),
      skipDuplicates: true,
    });
  }

  // 2) Verification: match confirmed Moments' planned moves against the
  //    feed's Transfers — planned → moved → done, closed by evidence. The
  //    Transfer legs are only fetched when a planned move is waiting.
  const plannedMoves = await prisma.bonusMove.findMany({
    where: { moment: { userId, status: "CONFIRMED" }, status: "PLANNED" },
    orderBy: { createdAt: "asc" },
  });
  const matchedMoveIds = new Set<string>();
  if (plannedMoves.length > 0) {
    const transferLegs = await prisma.feedTransaction.findMany({
      where: {
        linkedAccount: { connection: { userId } },
        postedAt: { gte: new Date(now.getTime() - TRANSFER_LOOKBACK_MS) },
        isTransfer: true,
      },
      select: { id: true, postedAt: true, amount: true },
    });
    const matches = matchMovesToTransfers(
      plannedMoves.map((m) => ({
        id: m.id,
        amountCents: m.amountCents,
        status: m.status as PlannedMove["status"],
        label: m.label,
        createdAt: m.createdAt,
      })),
      transferLegs.map((t) => ({
        id: t.id,
        postedAt: t.postedAt,
        amountCents: Math.round(Number(t.amount) * 100),
      })),
      now
    );
    for (const match of matches) {
      matchedMoveIds.add(match.moveId);
      await prisma.bonusMove.update({
        where: { id: match.moveId },
        data: {
          status: "DONE",
          matchedTransactionId: match.transactionId,
          matchedAt: now,
        },
      });
    }
  }

  // 3) The glance: oldest raised Moment, one at a time; one quiet line for
  //    a move still unmade after a week (the just-matched drop out).
  const raised = await prisma.bonusMoment.findFirst({
    where: { userId, status: "RAISED" },
    orderBy: [{ postedAt: "asc" }, { raisedAt: "asc" }],
  });

  const reminder = buildMoveReminder(
    plannedMoves
      .filter((m) => !matchedMoveIds.has(m.id))
      .map((m) => ({
        id: m.id,
        amountCents: m.amountCents,
        status: "PLANNED" as const,
        label: m.label,
        createdAt: m.createdAt,
      })),
    now
  );

  if (!raised) return { moment: null, reminder };

  const [plan, targetDebt, spotlight] = await Promise.all([
    readPlan(userId),
    findTargetDebt(userId),
    findSpotlight(userId),
  ]);
  const split = splitBonus(raised.amountCents, plan);
  const impact =
    targetDebt && split.debtCents > 0
      ? payoffImpact(targetDebt, split.debtCents)
      : null;
  const goal =
    spotlight && split.goalCents >= 0
      ? goalImpact(spotlight.progressCents, spotlight.targetCents, split.goalCents)
      : null;

  return {
    moment: {
      id: raised.id,
      amountCents: raised.amountCents,
      description: raised.description,
      postedAt: raised.postedAt.toISOString().slice(0, 10),
      plan: {
        debtPercent: plan.debtPercent,
        goalPercent: plan.goalPercent,
        guiltFreePercent: plan.guiltFreePercent,
      },
      split,
      targetDebtName: targetDebt?.name ?? null,
      payoffMonthsSaved: impact?.monthsSaved ?? null,
      goal:
        goal && spotlight
          ? { ...goal, name: spotlight.name, emoji: spotlight.emoji }
          : null,
    },
    reminder,
  };
}

// --- Deciding a Moment ----------------------------------------------------

/** Confirm stores the split in real dollars and produces the move list.
 * The optional override is per-Moment ("adjust this once") — the standing
 * plan is untouched. */
export async function confirmBonusMoment(input: {
  id: string;
  override?: BonusSplitPercents;
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };
  if (input.override) {
    const invalid = validateBonusPlan(input.override);
    if (invalid) return { error: invalid };
  }

  const moment = await prisma.bonusMoment.findFirst({
    where: { id: input.id, userId, status: "RAISED" },
  });
  if (!moment) return { error: "That Bonus Moment isn't open." };

  const [plan, targetDebt, spotlight] = await Promise.all([
    readPlan(userId),
    findTargetDebt(userId),
    findSpotlight(userId),
  ]);
  const split = splitBonus(moment.amountCents, input.override ?? plan);

  const moves: {
    kind: "DEBT" | "GOAL";
    label: string;
    amountCents: number;
  }[] = [];
  if (split.debtCents > 0 && targetDebt) {
    moves.push({ kind: "DEBT", label: targetDebt.name, amountCents: split.debtCents });
  }
  if (split.goalCents > 0 && spotlight) {
    moves.push({ kind: "GOAL", label: spotlight.name, amountCents: split.goalCents });
  }

  await prisma.$transaction([
    prisma.bonusMoment.update({
      where: { id: moment.id },
      data: {
        status: "CONFIRMED",
        decidedAt: new Date(),
        debtCents: split.debtCents,
        goalCents: split.goalCents,
        guiltFreeCents: split.guiltFreeCents,
      },
    }),
    ...(moves.length > 0
      ? [
          prisma.bonusMove.createMany({
            data: moves.map((m) => ({ momentId: moment.id, ...m })),
          }),
        ]
      : []),
  ]);
  revalidateAll();
  return { ok: true };
}

/** Saying no sticks (#34's precedent): dismissed is never re-raised — the
 * deposit's id stays recorded on the decided Moment. */
export async function dismissBonusMoment(input: {
  id: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };
  const updated = await prisma.bonusMoment.updateMany({
    where: { id: input.id, userId, status: "RAISED" },
    data: { status: "DISMISSED", decidedAt: new Date() },
  });
  if (updated.count === 0) return { error: "That Bonus Moment isn't open." };
  revalidateAll();
  return { ok: true };
}

// --- The manual fallback & the one-time migration -------------------------

/** "Add a bonus" the feed missed (#25): the same Moment, same card, same
 * one calm decision — never a separate bonus ledger. */
export async function recordManualBonus(input: {
  amountCents: number;
  description: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { error: "Enter the real amount that landed." };
  }
  const description = input.description.trim() || "Bonus";

  await prisma.bonusMoment.create({
    data: {
      userId,
      source: "MANUAL",
      description: description.slice(0, 120),
      postedAt: new Date(),
      amountCents: input.amountCents,
    },
  });
  revalidateAll();
  return { ok: true };
}

export interface LegacyBonusItem {
  id: string;
  name: string;
  /** Estimated net, cents — what migration would bring in as a Moment. */
  netCents: number;
}

/** Pre-#89 BonusItem rows, surfaced once for confirm-or-dismiss. */
export async function listLegacyBonusItems(): Promise<LegacyBonusItem[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const rows = await prisma.bonusItem.findMany({
    where: { profile: { userId }, resolvedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    netCents: Math.round(
      calculateBonusNet(Number(r.grossAmount), Number(r.estimatedTaxRate)) * 100
    ),
  }));
}

/** Bring it in (a MANUAL-path Moment at the estimated net) or let it go.
 * Either way the row is resolved forever — surfaced once, exactly. */
export async function resolveLegacyBonusItem(input: {
  id: string;
  decision: "MIGRATE" | "DISMISS";
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };

  const item = await prisma.bonusItem.findFirst({
    where: { id: input.id, profile: { userId }, resolvedAt: null },
  });
  if (!item) return { error: "That bonus was already reviewed." };

  const netCents = Math.round(
    calculateBonusNet(Number(item.grossAmount), Number(item.estimatedTaxRate)) * 100
  );
  await prisma.$transaction([
    prisma.bonusItem.update({
      where: { id: item.id },
      data: {
        resolvedAt: new Date(),
        resolution: input.decision === "MIGRATE" ? "MIGRATED" : "DISMISSED",
      },
    }),
    ...(input.decision === "MIGRATE" && netCents > 0
      ? [
          prisma.bonusMoment.create({
            data: {
              userId,
              source: "MIGRATED" as const,
              description: item.name.slice(0, 120),
              postedAt: item.expectedDate ?? new Date(),
              amountCents: netCents,
            },
          }),
        ]
      : []),
  ]);
  revalidateAll();
  return { ok: true };
}

// --- The deep-agenda condition (#82 hook) ---------------------------------

/** The Bonus Plan tune-up card joins the deep agenda only in months where
 * a Moment actually fired — reflection has a rhythm, not a backlog. */
export async function bonusMomentFiredThisMonth(): Promise<boolean> {
  const userId = await requireUserId();
  if (!userId) return false;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const count = await prisma.bonusMoment.count({
    where: { userId, raisedAt: { gte: monthStart, lt: nextMonthStart } },
  });
  return count > 0;
}
