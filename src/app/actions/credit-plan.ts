"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export interface CreditPlanData {
  currentScore: number | null;
  targetScore: number | null;
  targetUtilization: number;
  monitoringEnrolled: boolean;
  autopayAllAccounts: boolean;
  frozenBureaus: boolean;
  notes: string | null;
}

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function loadCreditPlan(): Promise<CreditPlanData | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const plan = await prisma.creditPlan.findUnique({
    where: { userId },
  });

  if (!plan) {
    return {
      currentScore: null,
      targetScore: null,
      targetUtilization: 10,
      monitoringEnrolled: false,
      autopayAllAccounts: false,
      frozenBureaus: false,
      notes: null,
    };
  }

  return {
    currentScore: plan.currentScore,
    targetScore: plan.targetScore,
    targetUtilization: plan.targetUtilization,
    monitoringEnrolled: plan.monitoringEnrolled,
    autopayAllAccounts: plan.autopayAllAccounts,
    frozenBureaus: plan.frozenBureaus,
    notes: plan.notes,
  };
}

export async function saveCreditPlan(data: Partial<CreditPlanData>) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.creditPlan.upsert({
    where: { userId },
    update: {
      currentScore: data.currentScore ?? null,
      targetScore: data.targetScore ?? null,
      targetUtilization: data.targetUtilization ?? 10,
      monitoringEnrolled: data.monitoringEnrolled ?? false,
      autopayAllAccounts: data.autopayAllAccounts ?? false,
      frozenBureaus: data.frozenBureaus ?? false,
      notes: data.notes ?? null,
    },
    create: {
      userId,
      currentScore: data.currentScore ?? null,
      targetScore: data.targetScore ?? null,
      targetUtilization: data.targetUtilization ?? 10,
      monitoringEnrolled: data.monitoringEnrolled ?? false,
      autopayAllAccounts: data.autopayAllAccounts ?? false,
      frozenBureaus: data.frozenBureaus ?? false,
      notes: data.notes ?? null,
    },
  });
}
