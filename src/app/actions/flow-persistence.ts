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

// The batch persist* actions are gone (#49-#52): every domain entity now
// mutates through awaited per-intent actions (src/app/actions/income.ts,
// spending-plan.ts, debts.ts, reflection.ts) — no whole-array replace,
// stable row ids. What remains here is the hydrate-on-auth read that fills
// the store's read mirror; #53 retires it.

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
