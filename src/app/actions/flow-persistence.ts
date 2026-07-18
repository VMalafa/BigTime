"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type {
  MoneyType,
  DebtType,
  DialCategory,
  BonusFrequency,
} from "@/lib/store/flow-store";
import type { FixedCostCategory } from "@/lib/constants/csp-ranges";

const ACTIVE_PROFILE_COOKIE = "active-profile-id";

async function getActiveProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const cookieStore = await cookies();
  const profileId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;

  if (profileId) {
    const exists = await prisma.profile.findFirst({
      where: { id: profileId, userId: user.id },
      select: { id: true },
    });
    if (exists) return profileId;
  }

  // Fallback to default
  const defaultProfile = await prisma.profile.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { id: true },
  });

  return defaultProfile?.id ?? null;
}

export async function persistScripts(scripts: Record<number, string>) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  const entries = Object.entries(scripts).map(([promptId, response]) => ({
    profileId,
    promptId: Number(promptId),
    response,
  }));

  for (const entry of entries) {
    await prisma.moneyScript.upsert({
      where: {
        profileId_promptId: {
          profileId: entry.profileId,
          promptId: entry.promptId,
        },
      },
      update: { response: entry.response },
      create: entry,
    });
  }
}

export async function persistMoneyType(moneyType: MoneyType) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  await prisma.profile.update({
    where: { id: profileId },
    data: { moneyType },
  });
}

// persistDebts is gone (#51): debt mutations are awaited per-intent
// actions in src/app/actions/debts.ts — the Mapping invariants (feed-owned
// balance, SET NULL unmapping) moved there. loadProfileFlowData still
// returns debts for the store's read mirror.

// persistIncomeSources / persistBonusItems are gone (#49): income and bonus
// mutations are awaited per-intent actions in src/app/actions/income.ts —
// no whole-array replace, stable row ids. loadProfileFlowData still returns
// both for the store's read mirror.

// persistSpendingPlan / persistFixedCostLineItems are gone (#50): CSP and
// line-item mutations are awaited per-intent actions in
// src/app/actions/spending-plan.ts — no whole-array replace, stable row
// ids. loadProfileFlowData still returns the plan for the store's read
// mirror.

export async function persistMoneyDials(dials: Record<string, number>) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  for (const [category, level] of Object.entries(dials)) {
    await prisma.moneyDial.upsert({
      where: {
        profileId_category: {
          profileId,
          category: category as DialCategory,
        },
      },
      update: { level },
      create: {
        profileId,
        category: category as DialCategory,
        level,
      },
    });
  }
}

export async function loadProfileFlowData() {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;

  const [
    profile,
    scripts,
    debts,
    incomeSources,
    bonusItems,
    spendingPlan,
    moneyDials,
  ] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: profileId },
      select: { moneyType: true },
    }),
    prisma.moneyScript.findMany({
      where: { profileId },
      select: { promptId: true, response: true },
    }),
    prisma.debt.findMany({
      where: { profileId },
    }),
    prisma.incomeSource.findMany({
      where: { profileId },
    }),
    prisma.bonusItem.findMany({
      where: { profileId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.spendingPlan.findUnique({
      where: { profileId },
      include: {
        fixedCostLineItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.moneyDial.findMany({
      where: { profileId },
    }),
  ]);

  return {
    moneyType: (profile?.moneyType as MoneyType) ?? null,
    scripts: Object.fromEntries(
      scripts.map((s) => [s.promptId, s.response])
    ) as Record<number, string>,
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: Number(d.balance),
      apr: Number(d.apr),
      minimumPayment: Number(d.minimumPayment),
      debtType: d.debtType as DebtType,
      creditLimit: d.creditLimit ? Number(d.creditLimit) : undefined,
      isShared: d.isShared,
    })),
    incomeSources: incomeSources.map((i) => ({
      id: i.id,
      name: i.name,
      monthlyAmount: Number(i.monthlyAmount),
      isAfterTax: i.isAfterTax,
    })),
    bonusItems: bonusItems.map((b) => ({
      id: b.id,
      name: b.name,
      grossAmount: Number(b.grossAmount),
      estimatedTaxRate: Number(b.estimatedTaxRate),
      frequency: b.frequency as BonusFrequency,
      expectedDate: b.expectedDate
        ? b.expectedDate.toISOString().slice(0, 10)
        : undefined,
      notes: b.notes ?? undefined,
    })),
    spendingPlan: spendingPlan
      ? {
          fixedCostsPercent: spendingPlan.fixedCostsPercent,
          savingsPercent: spendingPlan.savingsPercent,
          investmentsPercent: spendingPlan.investmentsPercent,
          guiltFreePercent: spendingPlan.guiltFreePercent,
          fixedCostsOverridden: spendingPlan.fixedCostsOverridden,
          fixedCostLineItems: spendingPlan.fixedCostLineItems.map((i) => ({
            id: i.id,
            category: i.category as FixedCostCategory,
            name: i.name,
            monthlyAmount: Number(i.monthlyAmount),
            note: i.note ?? undefined,
            sortOrder: i.sortOrder,
          })),
        }
      : null,
    moneyDials: Object.fromEntries(
      moneyDials.map((d) => [d.category, d.level])
    ) as Record<DialCategory, number>,
  };
}
