"use client";

// Server-authoritative income & bonus (#49; cache home per #53): reads
// hydrate from getIncomeData into a shared in-memory cache (one source for
// the flow income page AND the dashboard income page); every mutation is an
// awaited per-intent server action with optimistic UI + rollback via the
// shared runOptimistic shape (#109). No zustand, no localStorage.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import type { BonusEntry, IncomeEntry } from "@/lib/store/flow-store";
import { createEntityCache, runOptimistic } from "@/lib/hooks/entity-cache";
import {
  addIncomeSource,
  getIncomeData,
  removeIncomeSource,
  type IncomeSourceInput,
} from "@/app/actions/income";
import { generateId } from "@/lib/utils/validation";

export interface IncomeState {
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

  function addIncome(input: IncomeSourceInput): Promise<boolean> {
    setError(null);
    const tempId = generateId();
    return runOptimistic<IncomeState, IncomeEntry>({
      cache: incomeCache,
      optimistic: (s) => ({
        ...s,
        incomeSources: [...s.incomeSources, { id: tempId, ...input }],
      }),
      action: async () => {
        const result = await addIncomeSource(input);
        return "error" in result
          ? { error: result.error }
          : { value: result.incomeSource };
      },
      confirm: (s, created) => ({
        ...s,
        incomeSources: s.incomeSources.map((i) =>
          i.id === tempId ? created : i
        ),
      }),
      onError: setError,
    });
  }

  function removeIncome(id: string): Promise<boolean> {
    setError(null);
    return runOptimistic<IncomeState, void>({
      cache: incomeCache,
      optimistic: (s) => ({
        ...s,
        incomeSources: s.incomeSources.filter((i) => i.id !== id),
      }),
      action: async () => {
        const result = await removeIncomeSource(id);
        return result.error ? { error: result.error } : { value: undefined };
      },
      onError: setError,
    });
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
