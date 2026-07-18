"use server";

// Per-intent income & bonus actions (#49, ratified in #29): every mutation
// is awaited and touches exactly one row, so ids stay stable across edits
// and a stale client can never clobber newer writes with a whole-array
// flush. Reads come from getIncomeData — the flow income page and the
// dashboard income page answer from this one source.

import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import type { BonusEntry, IncomeEntry } from "@/lib/store/flow-store";
import type { BonusFrequency } from "@prisma/client";

function toIncomeEntry(row: {
  id: string;
  name: string;
  monthlyAmount: unknown;
  isAfterTax: boolean;
}): IncomeEntry {
  return {
    id: row.id,
    name: row.name,
    monthlyAmount: Number(row.monthlyAmount),
    isAfterTax: row.isAfterTax,
  };
}

function toBonusEntry(row: {
  id: string;
  name: string;
  grossAmount: unknown;
  estimatedTaxRate: unknown;
  frequency: BonusFrequency;
  expectedDate: Date | null;
  notes: string | null;
}): BonusEntry {
  return {
    id: row.id,
    name: row.name,
    grossAmount: Number(row.grossAmount),
    estimatedTaxRate: Number(row.estimatedTaxRate),
    frequency: row.frequency,
    expectedDate: row.expectedDate
      ? row.expectedDate.toISOString().slice(0, 10)
      : undefined,
    notes: row.notes ?? undefined,
  };
}

/** The one source both income pages read. */
export async function getIncomeData(): Promise<{
  incomeSources: IncomeEntry[];
  bonusItems: BonusEntry[];
} | null> {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;

  const [incomeSources, bonusItems] = await Promise.all([
    prisma.incomeSource.findMany({
      where: { profileId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bonusItem.findMany({
      where: { profileId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    incomeSources: incomeSources.map(toIncomeEntry),
    bonusItems: bonusItems.map(toBonusEntry),
  };
}

export interface IncomeSourceInput {
  name: string;
  monthlyAmount: number;
  isAfterTax: boolean;
}

function validateIncomeInput(input: IncomeSourceInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!Number.isFinite(input.monthlyAmount) || input.monthlyAmount <= 0)
    return "Enter a valid amount.";
  return null;
}

export async function addIncomeSource(
  input: IncomeSourceInput
): Promise<{ ok: true; incomeSource: IncomeEntry } | { error: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };
  const invalid = validateIncomeInput(input);
  if (invalid) return { error: invalid };

  const row = await prisma.incomeSource.create({
    data: {
      profileId,
      name: input.name.trim(),
      monthlyAmount: input.monthlyAmount,
      isAfterTax: input.isAfterTax,
    },
  });
  return { ok: true, incomeSource: toIncomeEntry(row) };
}

export async function updateIncomeSource(
  id: string,
  patch: Partial<IncomeSourceInput>
): Promise<{ ok: true; incomeSource: IncomeEntry } | { error: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const existing = await prisma.incomeSource.findFirst({
    where: { id, profileId },
  });
  if (!existing) return { error: "Income source not found." };

  const merged: IncomeSourceInput = {
    name: patch.name ?? existing.name,
    monthlyAmount: patch.monthlyAmount ?? Number(existing.monthlyAmount),
    isAfterTax: patch.isAfterTax ?? existing.isAfterTax,
  };
  const invalid = validateIncomeInput(merged);
  if (invalid) return { error: invalid };

  const row = await prisma.incomeSource.update({
    where: { id },
    data: {
      name: merged.name.trim(),
      monthlyAmount: merged.monthlyAmount,
      isAfterTax: merged.isAfterTax,
    },
  });
  return { ok: true, incomeSource: toIncomeEntry(row) };
}

export async function removeIncomeSource(
  id: string
): Promise<{ ok?: boolean; error?: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const deleted = await prisma.incomeSource.deleteMany({
    where: { id, profileId },
  });
  if (deleted.count === 0) return { error: "Income source not found." };
  return { ok: true };
}

export interface BonusItemInput {
  name: string;
  grossAmount: number;
  estimatedTaxRate: number;
  frequency: BonusFrequency;
  /** Date-only ISO string (YYYY-MM-DD). */
  expectedDate?: string;
  notes?: string;
}

function validateBonusInput(input: BonusItemInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!Number.isFinite(input.grossAmount) || input.grossAmount <= 0)
    return "Enter a valid amount.";
  if (
    !Number.isFinite(input.estimatedTaxRate) ||
    input.estimatedTaxRate < 0 ||
    input.estimatedTaxRate > 100
  )
    return "Tax rate must be 0-100.";
  return null;
}

export async function addBonusItem(
  input: BonusItemInput
): Promise<{ ok: true; bonusItem: BonusEntry } | { error: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };
  const invalid = validateBonusInput(input);
  if (invalid) return { error: invalid };

  const row = await prisma.bonusItem.create({
    data: {
      profileId,
      name: input.name.trim(),
      grossAmount: input.grossAmount,
      estimatedTaxRate: input.estimatedTaxRate,
      frequency: input.frequency,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      notes: input.notes?.trim() || null,
    },
  });
  return { ok: true, bonusItem: toBonusEntry(row) };
}

export async function updateBonusItem(
  id: string,
  patch: Partial<BonusItemInput>
): Promise<{ ok: true; bonusItem: BonusEntry } | { error: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const existing = await prisma.bonusItem.findFirst({
    where: { id, profileId },
  });
  if (!existing) return { error: "Bonus not found." };

  const merged: BonusItemInput = {
    name: patch.name ?? existing.name,
    grossAmount: patch.grossAmount ?? Number(existing.grossAmount),
    estimatedTaxRate:
      patch.estimatedTaxRate ?? Number(existing.estimatedTaxRate),
    frequency: patch.frequency ?? existing.frequency,
    expectedDate:
      patch.expectedDate !== undefined
        ? patch.expectedDate
        : (existing.expectedDate?.toISOString().slice(0, 10) ?? undefined),
    notes: patch.notes !== undefined ? patch.notes : (existing.notes ?? undefined),
  };
  const invalid = validateBonusInput(merged);
  if (invalid) return { error: invalid };

  const row = await prisma.bonusItem.update({
    where: { id },
    data: {
      name: merged.name.trim(),
      grossAmount: merged.grossAmount,
      estimatedTaxRate: merged.estimatedTaxRate,
      frequency: merged.frequency,
      expectedDate: merged.expectedDate ? new Date(merged.expectedDate) : null,
      notes: merged.notes?.trim() || null,
    },
  });
  return { ok: true, bonusItem: toBonusEntry(row) };
}

export async function removeBonusItem(
  id: string
): Promise<{ ok?: boolean; error?: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const deleted = await prisma.bonusItem.deleteMany({
    where: { id, profileId },
  });
  if (deleted.count === 0) return { error: "Bonus not found." };
  return { ok: true };
}
