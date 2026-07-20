"use server";

// Goals v1 actions (#86, ratified in #80): awaited per-intent mutations
// (#29). Invariants live here: one Goal per savings account (plus the DB
// unique on linkedAccountId), exactly one Spotlight (transactional swap —
// Prisma can't express the partial unique index), manual progress only
// while unlinked, and the feed balance owning progress once linked.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  CELEBRATION_BUDGET_CENTS,
  detectMilestones,
  goalPercentFunded,
  goalProgressCents,
  type GoalInput,
} from "@/lib/goals/engine";
import { getRequestUserId } from "@/lib/auth/request-user";

const PATHS = [
  "/dashboard",
  "/dashboard/goals",
  "/dashboard/timeline",
  "/dashboard/money-date",
];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

export interface GoalData {
  id: string;
  name: string;
  emoji: string | null;
  targetCents: number;
  targetDate: string | null;
  linkedAccountId: string | null;
  linkedAccountName: string | null;
  progressCents: number;
  percentFunded: number;
  manualCents: number;
  isSpotlight: boolean;
  sliceCents: number;
}

function toGoalInput(goal: {
  id: string;
  name: string;
  emoji: string | null;
  targetCents: number;
  manualCents: number;
  isSpotlight: boolean;
  sliceCents: number;
  linkedAccount: { currentBalance: unknown } | null;
}): GoalInput {
  return {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji,
    targetCents: goal.targetCents,
    linkedBalanceCents: goal.linkedAccount
      ? Math.round(Number(goal.linkedAccount.currentBalance) * 100)
      : null,
    manualCents: goal.manualCents,
    isSpotlight: goal.isSpotlight,
    sliceCents: goal.sliceCents,
  };
}

const GOAL_INCLUDE = {
  linkedAccount: { select: { currentBalance: true, name: true } },
} as const;

function toGoalData(goal: {
  id: string;
  name: string;
  emoji: string | null;
  targetCents: number;
  targetDate: Date | null;
  linkedAccountId: string | null;
  manualCents: number;
  isSpotlight: boolean;
  sliceCents: number;
  linkedAccount: { currentBalance: unknown; name: string } | null;
}): GoalData {
  const input = toGoalInput(goal);
  return {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji,
    targetCents: goal.targetCents,
    targetDate: goal.targetDate
      ? goal.targetDate.toISOString().slice(0, 10)
      : null,
    linkedAccountId: goal.linkedAccountId,
    linkedAccountName: goal.linkedAccount?.name ?? null,
    progressCents: goalProgressCents(input),
    percentFunded: goalPercentFunded(input),
    manualCents: goal.manualCents,
    isSpotlight: goal.isSpotlight,
    sliceCents: goal.sliceCents,
  };
}

export interface GoalsTruth {
  goals: GoalData[];
  /** Savings accounts still free for a 1:1 Goal link. */
  linkableAccounts: { id: string; name: string; balanceCents: number }[];
}

export async function listGoals(): Promise<GoalsTruth | null> {
  const userId = await getRequestUserId();
  if (!userId) return null;

  const [goals, accounts] = await Promise.all([
    prisma.goal.findMany({
      where: { userId },
      include: GOAL_INCLUDE,
      orderBy: [{ isSpotlight: "desc" }, { createdAt: "asc" }],
    }),
    prisma.linkedAccount.findMany({
      where: {
        connection: { userId },
        accountType: "SAVINGS",
        goal: null,
      },
      select: { id: true, name: true, currentBalance: true },
    }),
  ]);

  return {
    goals: goals.map(toGoalData),
    linkableAccounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      balanceCents: Math.round(Number(a.currentBalance) * 100),
    })),
  };
}

export async function createGoal(input: {
  name: string;
  emoji?: string;
  targetCents: number;
  targetDate?: string;
  linkedAccountId?: string;
  manualCents?: number;
}): Promise<{ goal: GoalData } | { error: string }> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  const name = input.name.trim();
  if (!name) return { error: "Give the dream a name." };
  if (!Number.isInteger(input.targetCents) || input.targetCents <= 0) {
    return { error: "Set a real target amount." };
  }

  if (input.linkedAccountId) {
    const account = await prisma.linkedAccount.findFirst({
      where: {
        id: input.linkedAccountId,
        connection: { userId },
        accountType: "SAVINGS",
      },
      include: { goal: { select: { id: true } } },
    });
    if (!account) return { error: "Pick one of your savings accounts." };
    if (account.goal) {
      return { error: "That account already carries a Goal — one each." };
    }
  }

  const existingCount = await prisma.goal.count({ where: { userId } });
  const goal = await prisma.goal.create({
    data: {
      userId,
      name,
      emoji: input.emoji?.trim() || null,
      targetCents: input.targetCents,
      targetDate: input.targetDate
        ? new Date(`${input.targetDate}T00:00:00.000Z`)
        : null,
      linkedAccountId: input.linkedAccountId ?? null,
      // Manual progress only stands while unlinked.
      manualCents: input.linkedAccountId ? 0 : (input.manualCents ?? 0),
      // The household's first Goal is the Spotlight by default.
      isSpotlight: existingCount === 0,
    },
    include: GOAL_INCLUDE,
  });

  revalidateAll();
  return { goal: toGoalData(goal) };
}

export async function updateGoal(input: {
  id: string;
  sliceCents?: number;
  manualCents?: number;
  linkedAccountId?: string | null;
}): Promise<{ goal: GoalData } | { error: string }> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  const existing = await prisma.goal.findFirst({
    where: { id: input.id, userId },
    select: { id: true, linkedAccountId: true },
  });
  if (!existing) return { error: "Goal not found." };

  if (input.sliceCents !== undefined) {
    if (!Number.isInteger(input.sliceCents) || input.sliceCents < 0) {
      return { error: "The slice must be a whole dollar amount." };
    }
  }

  if (input.linkedAccountId) {
    const account = await prisma.linkedAccount.findFirst({
      where: {
        id: input.linkedAccountId,
        connection: { userId },
        accountType: "SAVINGS",
      },
      include: { goal: { select: { id: true } } },
    });
    if (!account) return { error: "Pick one of your savings accounts." };
    if (account.goal && account.goal.id !== existing.id) {
      return { error: "That account already carries a Goal — one each." };
    }
  }

  const linked =
    input.linkedAccountId === undefined
      ? existing.linkedAccountId
      : input.linkedAccountId;

  const goal = await prisma.goal.update({
    where: { id: existing.id },
    data: {
      sliceCents: input.sliceCents,
      linkedAccountId:
        input.linkedAccountId === undefined ? undefined : input.linkedAccountId,
      // The feed owns progress once linked; manual writes only unlinked.
      manualCents:
        linked !== null
          ? undefined
          : input.manualCents !== undefined &&
              Number.isInteger(input.manualCents) &&
              input.manualCents >= 0
            ? input.manualCents
            : undefined,
    },
    include: GOAL_INCLUDE,
  });

  revalidateAll();
  return { goal: toGoalData(goal) };
}

/** One at a time — the slice moves with it. Transactional swap keeps the
 * invariant even against concurrent taps. */
export async function setSpotlight(input: {
  id: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  const target = await prisma.goal.findFirst({
    where: { id: input.id, userId },
    select: { id: true },
  });
  if (!target) return { error: "Goal not found." };

  await prisma.$transaction([
    prisma.goal.updateMany({
      where: { userId, isSpotlight: true },
      data: { isSpotlight: false },
    }),
    prisma.goal.update({
      where: { id: target.id },
      data: { isSpotlight: true },
    }),
  ]);

  revalidateAll();
  return { ok: true };
}

// --- Milestones ----------------------------------------------------------

export interface MilestoneData {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  celebrationBudgetCents: number;
}

/** Detection on read (#86): idempotent by natural key — a refetch can
 * only record facts not yet recorded, never double-fire. Resolves its own
 * session — "use server" exports are public endpoints and must never
 * take a caller-supplied userId. */
export async function detectAndListMilestones(): Promise<MilestoneData[]> {
  const userId = await getRequestUserId();
  if (!userId) return [];
  const [goals, debts, existing] = await Promise.all([
    prisma.goal.findMany({ where: { userId }, include: GOAL_INCLUDE }),
    prisma.debt.findMany({
      where: { profile: { userId } },
      select: { id: true, name: true, balance: true },
    }),
    prisma.milestone.findMany({
      where: { userId },
      select: { key: true },
    }),
  ]);

  const candidates = detectMilestones({
    goals: goals.map(toGoalInput),
    totalDebtCents: debts.reduce(
      (sum, d) => sum + Math.round(Number(d.balance) * 100),
      0
    ),
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      balanceCents: Math.round(Number(d.balance) * 100),
    })),
    existingKeys: new Set(existing.map((e) => e.key)),
  });

  if (candidates.length > 0) {
    await prisma.milestone.createMany({
      data: candidates.map((c) => ({
        userId,
        kind: c.kind,
        key: c.key,
        title: c.title,
        detail: c.detail ?? null,
        celebrationBudgetCents: c.celebrationBudgetCents,
        // Baselines anchor crossings and never prompt.
        status: c.silent ? ("ACCEPTED" as const) : ("RAISED" as const),
      })),
      skipDuplicates: true,
    });
  }

  const raised = await prisma.milestone.findMany({
    where: { userId, status: "RAISED", kind: { not: "DEBT_BASELINE" } },
    // Key as tiebreaker: a createMany batch shares one raisedAt, and
    // one-at-a-time must be deterministic (10% before 20% before 30%).
    orderBy: [{ raisedAt: "asc" }, { key: "asc" }],
  });
  return raised.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    detail: m.detail,
    celebrationBudgetCents: m.celebrationBudgetCents,
  }));
}

/** One-time semantics: accept or dismiss, never re-raised. */
export async function decideMilestone(input: {
  id: string;
  decision: "ACCEPTED" | "DISMISSED";
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  const updated = await prisma.milestone.updateMany({
    where: { id: input.id, userId, status: "RAISED" },
    data: { status: input.decision, decidedAt: new Date() },
  });
  if (updated.count === 0) return { error: "That Milestone isn't open." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Ratification note (#86): CELEBRATION_BUDGET_CENTS is a flat $50 v1. */
export async function celebrationBudgetCents(): Promise<number> {
  return CELEBRATION_BUDGET_CENTS;
}
