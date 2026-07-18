"use client";

// Server-authoritative income & bonus (#49): reads hydrate from
// getIncomeData (one source for the flow income page AND the dashboard
// income page); every mutation is an awaited per-intent server action with
// optimistic UI + rollback, per the Corrections-panel pattern. The zustand
// store keeps only a read mirror for the not-yet-converted pages
// (fixed-costs Reality Check, spending plan, summary) — it is never flushed
// back to the database for these entities.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFlowStore } from "@/lib/store/flow-store";
import {
  addBonusItem,
  addIncomeSource,
  getIncomeData,
  removeBonusItem,
  removeIncomeSource,
  type BonusItemInput,
  type IncomeSourceInput,
} from "@/app/actions/income";
import { generateId } from "@/lib/utils/validation";

export function useIncomeData() {
  const { isAuthenticated, loading } = useAuth();
  const incomeSources = useFlowStore((s) => s.incomeSources);
  const bonusItems = useFlowStore((s) => s.bonusItems);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the mirror from server truth on mount — this is what makes the
  // dashboard income page (which never ran the flow hydration) answer from
  // the same source as the flow income page.
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    getIncomeData().then((data) => {
      if (data) {
        useFlowStore.getState().setIncomeData(
          data.incomeSources,
          data.bonusItems
        );
      }
    });
  }, [isAuthenticated, loading]);

  async function addIncome(input: IncomeSourceInput): Promise<boolean> {
    setError(null);
    const store = useFlowStore.getState();
    const previous = store.incomeSources;
    const tempId = generateId();
    store.addIncome({ id: tempId, ...input });

    const result = await addIncomeSource(input);
    if ("error" in result) {
      useFlowStore.setState({ incomeSources: previous });
      setError(result.error);
      return false;
    }
    // Swap the optimistic row for the server row — ids stay stable from
    // here on, so later edits reference a real database row.
    useFlowStore.setState((s) => ({
      incomeSources: s.incomeSources.map((i) =>
        i.id === tempId ? result.incomeSource : i
      ),
    }));
    return true;
  }

  async function removeIncome(id: string): Promise<boolean> {
    setError(null);
    const previous = useFlowStore.getState().incomeSources;
    useFlowStore.setState((s) => ({
      incomeSources: s.incomeSources.filter((i) => i.id !== id),
    }));

    const result = await removeIncomeSource(id);
    if (result.error) {
      useFlowStore.setState({ incomeSources: previous });
      setError(result.error);
      return false;
    }
    return true;
  }

  async function addBonus(input: BonusItemInput): Promise<boolean> {
    setError(null);
    const store = useFlowStore.getState();
    const previous = store.bonusItems;
    const tempId = generateId();
    store.addBonus({ id: tempId, ...input });

    const result = await addBonusItem(input);
    if ("error" in result) {
      useFlowStore.setState({ bonusItems: previous });
      setError(result.error);
      return false;
    }
    useFlowStore.setState((s) => ({
      bonusItems: s.bonusItems.map((b) =>
        b.id === tempId ? result.bonusItem : b
      ),
    }));
    return true;
  }

  async function removeBonus(id: string): Promise<boolean> {
    setError(null);
    const previous = useFlowStore.getState().bonusItems;
    useFlowStore.setState((s) => ({
      bonusItems: s.bonusItems.filter((b) => b.id !== id),
    }));

    const result = await removeBonusItem(id);
    if (result.error) {
      useFlowStore.setState({ bonusItems: previous });
      setError(result.error);
      return false;
    }
    return true;
  }

  return {
    incomeSources,
    bonusItems,
    error,
    addIncome,
    removeIncome,
    addBonus,
    removeBonus,
  };
}
