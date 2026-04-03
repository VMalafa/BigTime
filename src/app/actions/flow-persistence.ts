"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type {
  MoneyType,
  DebtType,
  DialCategory,
  DebtEntry,
  IncomeEntry,
  SpendingPlanData,
} from "@/lib/store/flow-store";

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

export async function persistDebts(debts: DebtEntry[]) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  // Delete existing and replace
  await prisma.debt.deleteMany({ where: { profileId } });

  if (debts.length > 0) {
    await prisma.debt.createMany({
      data: debts.map((d) => ({
        profileId,
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        minimumPayment: d.minimumPayment,
        debtType: d.debtType as DebtType,
        creditLimit: d.creditLimit ?? null,
        isShared: d.isShared ?? false,
      })),
    });
  }
}

export async function persistIncomeSources(incomeSources: IncomeEntry[]) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  await prisma.incomeSource.deleteMany({ where: { profileId } });

  if (incomeSources.length > 0) {
    await prisma.incomeSource.createMany({
      data: incomeSources.map((i) => ({
        profileId,
        name: i.name,
        monthlyAmount: i.monthlyAmount,
        isAfterTax: i.isAfterTax,
      })),
    });
  }
}

export async function persistSpendingPlan(plan: SpendingPlanData) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  await prisma.spendingPlan.upsert({
    where: { profileId },
    update: {
      fixedCostsPercent: plan.fixedCostsPercent,
      savingsPercent: plan.savingsPercent,
      investmentsPercent: plan.investmentsPercent,
      guiltFreePercent: plan.guiltFreePercent,
    },
    create: {
      profileId,
      fixedCostsPercent: plan.fixedCostsPercent,
      savingsPercent: plan.savingsPercent,
      investmentsPercent: plan.investmentsPercent,
      guiltFreePercent: plan.guiltFreePercent,
    },
  });
}

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

  const [profile, scripts, debts, incomeSources, spendingPlan, moneyDials] =
    await Promise.all([
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
      prisma.spendingPlan.findUnique({
        where: { profileId },
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
    spendingPlan: spendingPlan
      ? {
          fixedCostsPercent: spendingPlan.fixedCostsPercent,
          savingsPercent: spendingPlan.savingsPercent,
          investmentsPercent: spendingPlan.investmentsPercent,
          guiltFreePercent: spendingPlan.guiltFreePercent,
        }
      : null,
    moneyDials: Object.fromEntries(
      moneyDials.map((d) => [d.category, d.level])
    ) as Record<DialCategory, number>,
  };
}
