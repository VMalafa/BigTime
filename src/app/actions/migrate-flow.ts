"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { DebtType, DialCategory } from "@/lib/store/flow-store";
import type { FixedCostCategory } from "@/lib/constants/csp-ranges";

interface LocalFlowData {
  scripts?: Record<number, string>;
  moneyType?: string | null;
  debts?: Array<{
    name: string;
    balance: number;
    apr: number;
    minimumPayment: number;
    debtType: string;
    creditLimit?: number;
    isShared?: boolean;
  }>;
  incomeSources?: Array<{
    name: string;
    monthlyAmount: number;
    isAfterTax: boolean;
  }>;
  spendingPlan?: {
    fixedCostsPercent: number;
    savingsPercent: number;
    investmentsPercent: number;
    guiltFreePercent: number;
    fixedCostsOverridden?: boolean;
    fixedCostLineItems?: Array<{
      category: string;
      name: string;
      monthlyAmount: number;
      note?: string;
      sortOrder?: number;
    }>;
  } | null;
  moneyDials?: Record<string, number>;
}

export async function migrateFlowData(localData: LocalFlowData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Find the user's default profile
  const profile = await prisma.profile.findFirst({
    where: { userId: user.id, isDefault: true },
  });

  if (!profile) return { error: "No profile found" };

  try {
    // Update money type
    if (localData.moneyType) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { moneyType: localData.moneyType as "OPTIMIZER" | "AVOIDER" | "WORRIER" | "DREAMER" },
      });
    }

    // Migrate scripts
    if (localData.scripts && Object.keys(localData.scripts).length > 0) {
      for (const [promptId, response] of Object.entries(localData.scripts)) {
        await prisma.moneyScript.upsert({
          where: {
            profileId_promptId: {
              profileId: profile.id,
              promptId: Number(promptId),
            },
          },
          update: { response },
          create: {
            profileId: profile.id,
            promptId: Number(promptId),
            response,
          },
        });
      }
    }

    // Migrate debts
    if (localData.debts && localData.debts.length > 0) {
      await prisma.debt.createMany({
        data: localData.debts.map((d) => ({
          profileId: profile.id,
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

    // Migrate income sources
    if (localData.incomeSources && localData.incomeSources.length > 0) {
      await prisma.incomeSource.createMany({
        data: localData.incomeSources.map((i) => ({
          profileId: profile.id,
          name: i.name,
          monthlyAmount: i.monthlyAmount,
          isAfterTax: i.isAfterTax,
        })),
      });
    }

    // Migrate spending plan (and its fixed-cost line items).
    // Line items are recreated with server-generated IDs to replace any
    // client-side ids carried in from localStorage.
    if (localData.spendingPlan) {
      const {
        fixedCostLineItems = [],
        fixedCostsOverridden = false,
        fixedCostsPercent,
        savingsPercent,
        investmentsPercent,
        guiltFreePercent,
      } = localData.spendingPlan;

      const createdPlan = await prisma.spendingPlan.create({
        data: {
          profileId: profile.id,
          fixedCostsPercent,
          savingsPercent,
          investmentsPercent,
          guiltFreePercent,
          fixedCostsOverridden,
        },
        select: { id: true },
      });

      if (fixedCostLineItems.length > 0) {
        await prisma.fixedCostLineItem.createMany({
          data: fixedCostLineItems.map((item, index) => ({
            spendingPlanId: createdPlan.id,
            category: item.category as FixedCostCategory,
            name: item.name,
            monthlyAmount: item.monthlyAmount,
            note: item.note ?? null,
            sortOrder: item.sortOrder ?? index,
          })),
        });
      }
    }

    // Migrate money dials
    if (localData.moneyDials) {
      for (const [category, level] of Object.entries(localData.moneyDials)) {
        await prisma.moneyDial.upsert({
          where: {
            profileId_category: {
              profileId: profile.id,
              category: category as DialCategory,
            },
          },
          update: { level },
          create: {
            profileId: profile.id,
            category: category as DialCategory,
            level,
          },
        });
      }
    }

    return { success: true };
  } catch (err) {
    console.error("Migration failed:", err);
    return { error: "Migration failed. Your local data is still preserved." };
  }
}
