"use server";

// Per-intent Conscious Spending Plan actions (#50, ratified in #29): the
// CSP percents save as one awaited intent; line items mutate row-by-row
// with server-generated stable ids — the full-replace flush (whose id
// churn meant nothing could ever reference a line item) is gone. Mappings,
// Earmarks, and cost-bearing calendar Events can now hold a
// FixedCostLineItem id and trust it tomorrow.

import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import type { SpendingPlanData } from "@/lib/store/flow-store";
import type { FixedCostCategory } from "@/lib/constants/csp-ranges";
import {
  FIXED_COST_CATEGORIES,
  FIXED_COST_MAX_AMOUNT,
} from "@/lib/constants/csp-ranges";

const VALID_CATEGORIES = new Set<string>(
  FIXED_COST_CATEGORIES.map((c) => c.key)
);

export type PlanResult =
  | { ok: true; plan: SpendingPlanData }
  | { ok?: undefined; error: string };

async function readPlan(profileId: string): Promise<SpendingPlanData | null> {
  const plan = await prisma.spendingPlan.findUnique({
    where: { profileId },
    include: { fixedCostLineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!plan) return null;
  return {
    fixedCostsPercent: plan.fixedCostsPercent,
    savingsPercent: plan.savingsPercent,
    investmentsPercent: plan.investmentsPercent,
    guiltFreePercent: plan.guiltFreePercent,
    fixedCostsOverridden: plan.fixedCostsOverridden,
    fixedCostLineItems: plan.fixedCostLineItems.map((item) => ({
      id: item.id,
      category: item.category as FixedCostCategory,
      name: item.name,
      monthlyAmount: Number(item.monthlyAmount),
      note: item.note ?? undefined,
      sortOrder: item.sortOrder,
    })),
  };
}

/** The one source for the plan and its line items. */
export async function getSpendingPlanData(): Promise<SpendingPlanData | null> {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;
  return readPlan(profileId);
}

/** Ensure the profile has a plan row to hang line items off — the flow
 * reaches fixed costs before the CSP percents exist. */
async function ensurePlan(profileId: string): Promise<string> {
  const existing = await prisma.spendingPlan.findUnique({
    where: { profileId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.spendingPlan.create({
    data: {
      profileId,
      fixedCostsPercent: 0,
      savingsPercent: 0,
      investmentsPercent: 0,
      guiltFreePercent: 0,
    },
    select: { id: true },
  });
  return created.id;
}

/** After any line-item mutation, keep the derived Fixed Costs percent in
 * sync unless the human has overridden the slider — the same rule the
 * store applied, now next to the one income source that feeds it. */
async function syncSuggestedPercent(profileId: string): Promise<void> {
  const plan = await prisma.spendingPlan.findUnique({
    where: { profileId },
    select: {
      id: true,
      fixedCostsPercent: true,
      fixedCostsOverridden: true,
      fixedCostLineItems: { select: { monthlyAmount: true } },
    },
  });
  if (!plan || plan.fixedCostsOverridden) return;

  const incomeSources = await prisma.incomeSource.findMany({
    where: { profileId },
    select: { monthlyAmount: true },
  });
  const totalIncome = incomeSources.reduce(
    (sum, s) => sum + Number(s.monthlyAmount),
    0
  );
  if (totalIncome <= 0) return;

  const totalFixed = plan.fixedCostLineItems.reduce(
    (sum, i) => sum + Number(i.monthlyAmount),
    0
  );
  const suggested = Math.round((totalFixed / totalIncome) * 100);
  if (suggested !== plan.fixedCostsPercent) {
    await prisma.spendingPlan.update({
      where: { id: plan.id },
      data: { fixedCostsPercent: suggested },
    });
  }
}

export interface SavePlanInput {
  fixedCostsPercent: number;
  savingsPercent: number;
  investmentsPercent: number;
  guiltFreePercent: number;
  fixedCostsOverridden: boolean;
}

/** One intent: save the CSP. Percents must be whole and total 100. */
export async function saveSpendingPlan(
  input: SavePlanInput
): Promise<PlanResult> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const percents = [
    input.fixedCostsPercent,
    input.savingsPercent,
    input.investmentsPercent,
    input.guiltFreePercent,
  ];
  if (percents.some((p) => !Number.isInteger(p) || p < 0 || p > 100)) {
    return { error: "Each bucket must be a whole percent between 0 and 100." };
  }
  if (percents.reduce((a, b) => a + b, 0) !== 100) {
    return { error: "The four buckets must total 100%." };
  }

  const data = {
    fixedCostsPercent: input.fixedCostsPercent,
    savingsPercent: input.savingsPercent,
    investmentsPercent: input.investmentsPercent,
    guiltFreePercent: input.guiltFreePercent,
    fixedCostsOverridden: input.fixedCostsOverridden,
  };
  await prisma.spendingPlan.upsert({
    where: { profileId },
    update: data,
    create: { profileId, ...data },
  });

  const plan = await readPlan(profileId);
  if (!plan) return { error: "Plan not found after save." };
  return { ok: true, plan };
}

export interface LineItemInput {
  category: string;
  name: string;
  monthlyAmount: number;
  note?: string;
}

function validateLineItem(input: LineItemInput): string | null {
  if (!VALID_CATEGORIES.has(input.category)) return "Unknown category.";
  if (!input.name.trim()) return "Name is required.";
  if (!Number.isFinite(input.monthlyAmount) || input.monthlyAmount < 0)
    return "Enter a valid amount.";
  if (input.monthlyAmount > FIXED_COST_MAX_AMOUNT)
    return "Amount is beyond the supported maximum.";
  return null;
}

export async function addFixedCostLineItem(
  input: LineItemInput
): Promise<PlanResult> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };
  const invalid = validateLineItem(input);
  if (invalid) return { error: invalid };

  const planId = await ensurePlan(profileId);
  const count = await prisma.fixedCostLineItem.count({
    where: { spendingPlanId: planId },
  });
  await prisma.fixedCostLineItem.create({
    data: {
      spendingPlanId: planId,
      category: input.category as FixedCostCategory,
      name: input.name.trim(),
      monthlyAmount: input.monthlyAmount,
      note: input.note?.trim() || null,
      sortOrder: count,
    },
  });
  await syncSuggestedPercent(profileId);

  const plan = await readPlan(profileId);
  if (!plan) return { error: "Plan not found after save." };
  return { ok: true, plan };
}

export async function updateFixedCostLineItem(
  id: string,
  patch: Partial<LineItemInput>
): Promise<PlanResult> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const existing = await prisma.fixedCostLineItem.findFirst({
    where: { id, spendingPlan: { profileId } },
  });
  if (!existing) return { error: "Line item not found." };

  const merged: LineItemInput = {
    category: patch.category ?? existing.category,
    name: patch.name ?? existing.name,
    monthlyAmount: patch.monthlyAmount ?? Number(existing.monthlyAmount),
    note: patch.note !== undefined ? patch.note : (existing.note ?? undefined),
  };
  const invalid = validateLineItem(merged);
  if (invalid) return { error: invalid };

  await prisma.fixedCostLineItem.update({
    where: { id },
    data: {
      category: merged.category as FixedCostCategory,
      name: merged.name.trim(),
      monthlyAmount: merged.monthlyAmount,
      note: merged.note?.trim() || null,
    },
  });
  await syncSuggestedPercent(profileId);

  const plan = await readPlan(profileId);
  if (!plan) return { error: "Plan not found after save." };
  return { ok: true, plan };
}

export async function removeFixedCostLineItem(id: string): Promise<PlanResult> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const deleted = await prisma.fixedCostLineItem.deleteMany({
    where: { id, spendingPlan: { profileId } },
  });
  if (deleted.count === 0) return { error: "Line item not found." };
  await syncSuggestedPercent(profileId);

  const plan = await readPlan(profileId);
  if (!plan) return { error: "Plan not found after save." };
  return { ok: true, plan };
}

/** One intent: persist a new ordering. Ids not listed keep their spot at
 * the end (defensive — the client always sends the full list). */
export async function reorderFixedCostLineItems(
  orderedIds: string[]
): Promise<PlanResult> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const rows = await prisma.fixedCostLineItem.findMany({
    where: { spendingPlan: { profileId } },
    select: { id: true },
  });
  const owned = new Set(rows.map((r) => r.id));
  const updates = orderedIds
    .filter((id) => owned.has(id))
    .map((id, index) =>
      prisma.fixedCostLineItem.update({
        where: { id },
        data: { sortOrder: index },
      })
    );
  if (updates.length > 0) await prisma.$transaction(updates);

  const plan = await readPlan(profileId);
  if (!plan) return { error: "Plan not found after save." };
  return { ok: true, plan };
}
