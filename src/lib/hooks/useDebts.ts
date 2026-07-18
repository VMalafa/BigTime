"use client";

// Server-authoritative debts (#51): reads hydrate from getDebtsData (one
// source for the flow debts page AND the dashboard debts page); every
// mutation is an awaited per-intent action with optimistic UI + rollback.
// The zustand copy remains a read mirror for not-yet-converted consumers
// (summary, automation suggestions) and is never flushed back.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFlowStore, type DebtEntry } from "@/lib/store/flow-store";
import {
  addDebt as addDebtAction,
  getDebtsData,
  removeDebt as removeDebtAction,
  updateDebt as updateDebtAction,
  type DebtInput,
} from "@/app/actions/debts";
import { generateId } from "@/lib/utils/validation";

export function useDebts() {
  const { isAuthenticated, loading } = useAuth();
  const debts = useFlowStore((s) => s.debts);
  const [mappedIds, setMappedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function refresh(): Promise<void> {
    return getDebtsData().then((data) => {
      if (!data) return;
      useFlowStore.setState({
        debts: data.map(({ mapped, ...debt }) => {
          void mapped;
          return debt;
        }),
      });
      setMappedIds(new Set(data.filter((d) => d.mapped).map((d) => d.id)));
    });
  }

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    void refresh();
  }, [isAuthenticated, loading]);

  async function addDebt(input: DebtInput): Promise<boolean> {
    setError(null);
    const previous = useFlowStore.getState().debts;
    const tempId = generateId();
    useFlowStore.getState().addDebt({ id: tempId, ...input });

    const result = await addDebtAction(input);
    if ("error" in result) {
      useFlowStore.setState({ debts: previous });
      setError(result.error);
      return false;
    }
    const created = result.debt;
    useFlowStore.setState((s) => ({
      debts: s.debts.map((d) => (d.id === tempId ? created : d)),
    }));
    return true;
  }

  async function updateDebt(
    id: string,
    patch: Partial<DebtInput>
  ): Promise<boolean> {
    setError(null);
    const previous = useFlowStore.getState().debts;
    useFlowStore.getState().updateDebt(id, patch as Partial<DebtEntry>);

    const result = await updateDebtAction(id, patch);
    if ("error" in result) {
      useFlowStore.setState({ debts: previous });
      setError(result.error);
      return false;
    }
    const updated = result.debt;
    useFlowStore.setState((s) => ({
      debts: s.debts.map((d) => (d.id === id ? updated : d)),
    }));
    return true;
  }

  async function removeDebt(id: string): Promise<boolean> {
    setError(null);
    const previous = useFlowStore.getState().debts;
    useFlowStore.setState((s) => ({
      debts: s.debts.filter((d) => d.id !== id),
    }));

    const result = await removeDebtAction(id);
    if (result.error) {
      useFlowStore.setState({ debts: previous });
      setError(result.error);
      return false;
    }
    return true;
  }

  return {
    debts,
    mappedIds,
    error,
    addDebt,
    updateDebt,
    removeDebt,
    refresh,
  };
}
