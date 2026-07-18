"use client";

// Server-authoritative debts (#51; cache home per #53): reads hydrate from
// getDebtsData into a shared in-memory cache (one source for the flow debts
// page AND the dashboard debts page); every mutation is an awaited
// per-intent action with optimistic UI + rollback. No zustand, no
// localStorage.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import type { DebtEntry } from "@/lib/store/flow-store";
import { createEntityCache } from "@/lib/hooks/entity-cache";
import {
  addDebt as addDebtAction,
  getDebtsData,
  removeDebt as removeDebtAction,
  updateDebt as updateDebtAction,
  type DebtInput,
} from "@/app/actions/debts";
import { generateId } from "@/lib/utils/validation";

interface DebtsState {
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

  async function addDebt(input: DebtInput): Promise<boolean> {
    setError(null);
    const previous = debtsCache.get();
    const tempId = generateId();
    debtsCache.set((s) => ({
      ...s,
      debts: [...s.debts, { id: tempId, ...input }],
    }));

    const result = await addDebtAction(input);
    if ("error" in result) {
      debtsCache.set(previous);
      setError(result.error);
      return false;
    }
    const created = result.debt;
    debtsCache.set((s) => ({
      ...s,
      debts: s.debts.map((d) => (d.id === tempId ? created : d)),
    }));
    return true;
  }

  async function updateDebt(
    id: string,
    patch: Partial<DebtInput>
  ): Promise<boolean> {
    setError(null);
    const previous = debtsCache.get();
    debtsCache.set((s) => ({
      ...s,
      debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));

    const result = await updateDebtAction(id, patch);
    if ("error" in result) {
      debtsCache.set(previous);
      setError(result.error);
      return false;
    }
    const updated = result.debt;
    debtsCache.set((s) => ({
      ...s,
      debts: s.debts.map((d) => (d.id === id ? updated : d)),
    }));
    return true;
  }

  async function removeDebt(id: string): Promise<boolean> {
    setError(null);
    const previous = debtsCache.get();
    debtsCache.set((s) => ({
      ...s,
      debts: s.debts.filter((d) => d.id !== id),
    }));

    const result = await removeDebtAction(id);
    if (result.error) {
      debtsCache.set(previous);
      setError(result.error);
      return false;
    }
    return true;
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
