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

// The BonusItem mutations are retired (#89): windfalls are Bonus Moments
// now — raised by feed detection or the manual fallback (actions/bonus.ts)
// and decided once. Existing rows stay readable (getIncomeData) until each
// is migrated or let go through resolveLegacyBonusItem.
