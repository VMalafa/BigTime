"use client";

// Server-authoritative debts (#51; cache home per #53): reads hydrate from
// getDebtsData into a shared in-memory cache (one source for the flow debts
// page AND the dashboard debts page); every mutation is an awaited
// per-intent action with optimistic UI + rollback via the shared
// runOptimistic shape (#109). No zustand, no localStorage.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import type { DebtEntry } from "@/lib/store/flow-store";
import { createEntityCache, runOptimistic } from "@/lib/hooks/entity-cache";
import {
  addDebt as addDebtAction,
  getDebtsData,
  removeDebt as removeDebtAction,
  updateDebt as updateDebtAction,
  type DebtInput,
} from "@/app/actions/debts";
import { generateId } from "@/lib/utils/validation";

export interface DebtsState {
  debts: DebtEntry[];
  mappedIds: string[];
}

export const debtsCache = createEntityCache<DebtsState>({
  debts: [],
  mappedIds: [],
});

export function useDebts() {
  const { isAuthenticated, loading } = useAuth();
  const { debts, mappedIds } = debtsCache.use();
  const [error, setError] = useState<string | null>(null);

  function refresh(): Promise<void> {
    return debtsCache.hydrate(async () => {
      const data = await getDebtsData();
      if (!data) return null;
      return {
        debts: data.map(({ mapped, ...debt }) => {
          void mapped;
          return debt;
        }),
        mappedIds: data.filter((d) => d.mapped).map((d) => d.id),
      };
    });
  }

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    void refresh();
  }, [isAuthenticated, loading]);

  function addDebt(input: DebtInput): Promise<boolean> {
    setError(null);
    const tempId = generateId();
    return runOptimistic<DebtsState, DebtEntry>({
      cache: debtsCache,
      optimistic: (s) => ({
        ...s,
        debts: [...s.debts, { id: tempId, ...input }],
      }),
      action: async () => {
        const result = await addDebtAction(input);
        return "error" in result
          ? { error: result.error }
          : { value: result.debt };
      },
      confirm: (s, created) => ({
        ...s,
        debts: s.debts.map((d) => (d.id === tempId ? created : d)),
      }),
      onError: setError,
    });
  }

  function updateDebt(id: string, patch: Partial<DebtInput>): Promise<boolean> {
    setError(null);
    return runOptimistic<DebtsState, DebtEntry>({
      cache: debtsCache,
      optimistic: (s) => ({
        ...s,
        debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }),
      action: async () => {
        const result = await updateDebtAction(id, patch);
        return "error" in result
          ? { error: result.error }
          : { value: result.debt };
      },
      confirm: (s, updated) => ({
        ...s,
        debts: s.debts.map((d) => (d.id === id ? updated : d)),
      }),
      onError: setError,
    });
  }

  function removeDebt(id: string): Promise<boolean> {
    setError(null);
    return runOptimistic<DebtsState, void>({
      cache: debtsCache,
      optimistic: (s) => ({
        ...s,
        debts: s.debts.filter((d) => d.id !== id),
      }),
      action: async () => {
        const result = await removeDebtAction(id);
        return result.error ? { error: result.error } : { value: undefined };
      },
      onError: setError,
    });
  }

  return {
    debts,
    mappedIds: new Set(mappedIds),
    error,
    addDebt,
    updateDebt,
    removeDebt,
    refresh,
  };
}
