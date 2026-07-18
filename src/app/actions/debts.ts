"use server";

// Per-intent Debt actions (#51, ratified in #29). Debts already flushed
// diff-based to protect Mappings — this finishes the job: single-row
// awaited writes, stable ids, and the Mapping invariants enforced where
// the data lives. A mapped Debt's balance is feed-owned (a manual balance
// write is silently ignored, exactly as the diff flush behaved); APR,
// minimum payment, and credit limit stay manual. Deleting a mapped Debt
// unmaps its Linked Account via the FK's SET NULL — unchanged.

import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import type { DebtEntry, DebtType } from "@/lib/store/flow-store";

const DEBT_TYPES: ReadonlySet<string> = new Set([
  "CREDIT_CARD",
  "PERSONAL_LOAN",
  "STUDENT_LOAN",
  "AUTO_LOAN",
  "MORTGAGE",
  "MEDICAL",
  "OTHER_REVOLVING",
  "OTHER_INSTALLMENT",
]);

function toDebtEntry(row: {
  id: string;
  name: string;
  balance: unknown;
  apr: unknown;
  minimumPayment: unknown;
  debtType: string;
  creditLimit: unknown | null;
  isShared: boolean;
}): DebtEntry {
  return {
    id: row.id,
    name: row.name,
    balance: Number(row.balance),
    apr: Number(row.apr),
    minimumPayment: Number(row.minimumPayment),
    debtType: row.debtType as DebtType,
    creditLimit: row.creditLimit !== null ? Number(row.creditLimit) : undefined,
    isShared: row.isShared,
  };
}

export interface DebtWithMapping extends DebtEntry {
  /** True when a Linked Account owns this Debt's balance. */
  mapped: boolean;
}

/** The one source for both debts pages. */
export async function getDebtsData(): Promise<DebtWithMapping[] | null> {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;

  const rows = await prisma.debt.findMany({
    where: { profileId },
    include: { linkedAccount: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    ...toDebtEntry(row),
    mapped: row.linkedAccount !== null,
  }));
}

export interface DebtInput {
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  debtType: DebtType;
  creditLimit?: number;
  isShared?: boolean;
}

function validateDebt(input: DebtInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!Number.isFinite(input.balance) || input.balance < 0)
    return "Enter a valid balance.";
  if (!Number.isFinite(input.apr) || input.apr < 0 || input.apr > 100)
    return "Enter a valid APR (0-100).";
  if (!Number.isFinite(input.minimumPayment) || input.minimumPayment < 0)
    return "Enter a valid minimum payment.";
  if (!DEBT_TYPES.has(input.debtType)) return "Unknown debt type.";
  if (
    input.creditLimit !== undefined &&
    (!Number.isFinite(input.creditLimit) || input.creditLimit < 0)
  )
    return "Enter a valid credit limit.";
  return null;
}

export async function addDebt(
  input: DebtInput
): Promise<{ ok: true; debt: DebtEntry } | { error: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };
  const invalid = validateDebt(input);
  if (invalid) return { error: invalid };

  const row = await prisma.debt.create({
    data: {
      profileId,
      name: input.name.trim(),
      balance: input.balance,
      apr: input.apr,
      minimumPayment: input.minimumPayment,
      debtType: input.debtType,
      creditLimit: input.creditLimit ?? null,
      isShared: input.isShared ?? false,
    },
  });
  return { ok: true, debt: toDebtEntry(row) };
}

export async function updateDebt(
  id: string,
  patch: Partial<DebtInput>
): Promise<{ ok: true; debt: DebtEntry } | { error: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  const existing = await prisma.debt.findFirst({
    where: { id, profileId },
    include: { linkedAccount: { select: { id: true } } },
  });
  if (!existing) return { error: "Debt not found." };

  const merged: DebtInput = {
    name: patch.name ?? existing.name,
    balance: patch.balance ?? Number(existing.balance),
    apr: patch.apr ?? Number(existing.apr),
    minimumPayment: patch.minimumPayment ?? Number(existing.minimumPayment),
    debtType: patch.debtType ?? (existing.debtType as DebtType),
    creditLimit:
      patch.creditLimit !== undefined
        ? patch.creditLimit
        : existing.creditLimit !== null
          ? Number(existing.creditLimit)
          : undefined,
    isShared: patch.isShared ?? existing.isShared,
  };
  const invalid = validateDebt(merged);
  if (invalid) return { error: invalid };

  const mapped = existing.linkedAccount !== null;
  const row = await prisma.debt.update({
    where: { id },
    data: {
      name: merged.name.trim(),
      apr: merged.apr,
      minimumPayment: merged.minimumPayment,
      debtType: merged.debtType,
      creditLimit: merged.creditLimit ?? null,
      isShared: merged.isShared ?? false,
      // Mapping invariant: the feed owns a mapped Debt's balance — a manual
      // balance write is dropped, matching the old diff-flush behavior.
      ...(mapped ? {} : { balance: merged.balance }),
    },
  });
  return { ok: true, debt: toDebtEntry(row) };
}

export async function removeDebt(
  id: string
): Promise<{ ok?: boolean; error?: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };

  // Deleting a mapped Debt unmaps its Linked Account (FK is SET NULL).
  const deleted = await prisma.debt.deleteMany({ where: { id, profileId } });
  if (deleted.count === 0) return { error: "Debt not found." };
  return { ok: true };
}
