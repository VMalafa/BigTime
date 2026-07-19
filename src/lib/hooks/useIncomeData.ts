"use client";

// Server-authoritative income & bonus (#49; cache home per #53): reads
// hydrate from getIncomeData into a shared in-memory cache (one source for
// the flow income page AND the dashboard income page); every mutation is an
// awaited per-intent server action with optimistic UI + rollback, per the
// Corrections-panel pattern. No zustand, no localStorage.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import type { BonusEntry, IncomeEntry } from "@/lib/store/flow-store";
import { createEntityCache } from "@/lib/hooks/entity-cache";
import {
  addIncomeSource,
  getIncomeData,
  removeIncomeSource,
  type IncomeSourceInput,
} from "@/app/actions/income";
import { generateId } from "@/lib/utils/validation";

interface IncomeState {
  incomeSources: IncomeEntry[];
  bonusItems: BonusEntry[];
}

export const incomeCache = createEntityCache<IncomeState>({
  incomeSources: [],
  bonusItems: [],
});

export function useIncomeData() {
  const { isAuthenticated, loading } = useAuth();
  const { incomeSources, bonusItems } = incomeCache.use();
  const [error, setError] = useState<string | null>(null);

  // Hydrate from server truth on mount — every consumer answers from the
  // same snapshot.
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    void incomeCache.hydrate(getIncomeData);
  }, [isAuthenticated, loading]);

  async function addIncome(input: IncomeSourceInput): Promise<boolean> {
    setError(null);
    const previous = incomeCache.get();
    const tempId = generateId();
    incomeCache.set((s) => ({
      ...s,
      incomeSources: [...s.incomeSources, { id: tempId, ...input }],
    }));

    const result = await addIncomeSource(input);
    if ("error" in result) {
      incomeCache.set(previous);
      setError(result.error);
      return false;
    }
    incomeCache.set((s) => ({
      ...s,
      incomeSources: s.incomeSources.map((i) =>
        i.id === tempId ? result.incomeSource : i
      ),
    }));
    return true;
  }

  async function removeIncome(id: string): Promise<boolean> {
    setError(null);
    const previous = incomeCache.get();
    incomeCache.set((s) => ({
      ...s,
      incomeSources: s.incomeSources.filter((i) => i.id !== id),
    }));

    const result = await removeIncomeSource(id);
    if (result.error) {
      incomeCache.set(previous);
      setError(result.error);
      return false;
    }
    return true;
  }

  const totalMonthlyIncome = incomeSources.reduce(
    (sum, s) => sum + s.monthlyAmount,
    0
  );

  // The standalone bonus ledger is retired (#89): windfalls are Bonus
  // Moments now, raised by the feed (or the manual fallback) and decided
  // once. bonusItems remain readable for surfaces that still reference
  // pre-migration rows; the mutations are gone.
  return {
    incomeSources,
    bonusItems,
    error,
    addIncome,
    removeIncome,
    totalMonthlyIncome,
  };
}
