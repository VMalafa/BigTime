"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { MoneyType, DialCategory } from "@/lib/store/flow-store";

export async function getHouseholdFinancials() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    include: {
      debts: true,
      incomeSources: true,
      bonusItems: true,
      spendingPlan: true,
      moneyDials: true,
      moneyScripts: true,
    },
  });

  if (profiles.length === 0) return null;

  // Aggregate across all profiles
  const allDebts = profiles.flatMap((p) =>
    p.debts.map((d) => ({
      id: d.id,
      profileName: p.name,
      name: d.name,
      balance: Number(d.balance),
      apr: Number(d.apr),
      minimumPayment: Number(d.minimumPayment),
      debtType: d.debtType,
      creditLimit: d.creditLimit ? Number(d.creditLimit) : undefined,
    }))
  );

  const allIncome = profiles.flatMap((p) =>
    p.incomeSources.map((i) => ({
      id: i.id,
      profileName: p.name,
      name: i.name,
      monthlyAmount: Number(i.monthlyAmount),
      isAfterTax: i.isAfterTax,
    }))
  );

  const allBonuses = profiles.flatMap((p) =>
    p.bonusItems.map((b) => ({
      id: b.id,
      profileName: p.name,
      name: b.name,
      grossAmount: Number(b.grossAmount),
      estimatedTaxRate: Number(b.estimatedTaxRate),
      frequency: b.frequency,
      expectedDate: b.expectedDate
        ? b.expectedDate.toISOString().slice(0, 10)
        : undefined,
      notes: b.notes ?? undefined,
    }))
  );

  const totalDebt = allDebts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinPayments = allDebts.reduce(
    (sum, d) => sum + d.minimumPayment,
    0
  );
  const totalMonthlyIncome = allIncome.reduce(
    (sum, i) => sum + i.monthlyAmount,
    0
  );

  const frequencyPerYear = (f: string) =>
    f === "QUARTERLY" ? 4 : f === "SEMI_ANNUAL" ? 2 : 1;
  const totalAnnualBonusNet = allBonuses.reduce((sum, b) => {
    const net = b.grossAmount * (1 - b.estimatedTaxRate / 100);
    return sum + net * frequencyPerYear(b.frequency);
  }, 0);
  const monthlyBonusEquivalent = totalAnnualBonusNet / 12;
  const effectiveMonthlyIncome = totalMonthlyIncome + monthlyBonusEquivalent;

  return {
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      moneyType: p.moneyType as MoneyType | null,
    })),
    debts: allDebts,
    income: allIncome,
    bonuses: allBonuses,
    totalDebt,
    totalMinPayments,
    totalMonthlyIncome,
    totalAnnualBonusNet,
    monthlyBonusEquivalent,
    effectiveMonthlyIncome,
    debtCount: allDebts.length,
    profileCount: profiles.length,
  };
}

export async function getAIHouseholdContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    include: {
      moneyScripts: { orderBy: { promptId: "asc" } },
      moneyDials: true,
      debts: true,
      incomeSources: true,
      spendingPlan: true,
    },
  });

  return {
    householdSize: profiles.length,
    personas: profiles.map((p) => ({
      name: p.name,
      moneyType: p.moneyType,
      scripts: p.moneyScripts.map((s) => ({
        promptId: s.promptId,
        response: s.response,
        aiReflection: s.aiReflection,
      })),
      moneyDials: Object.fromEntries(
        p.moneyDials.map((d) => [d.category, d.level])
      ) as Record<string, number>,
      totalDebt: p.debts.reduce((sum, d) => sum + Number(d.balance), 0),
      totalIncome: p.incomeSources.reduce(
        (sum, i) => sum + Number(i.monthlyAmount),
        0
      ),
      spendingPlan: p.spendingPlan
        ? {
            fixedCostsPercent: p.spendingPlan.fixedCostsPercent,
            savingsPercent: p.spendingPlan.savingsPercent,
            investmentsPercent: p.spendingPlan.investmentsPercent,
            guiltFreePercent: p.spendingPlan.guiltFreePercent,
          }
        : null,
    })),
  };
}
