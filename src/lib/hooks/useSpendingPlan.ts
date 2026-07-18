"use client";

// Server-authoritative Conscious Spending Plan (#50): reads hydrate from
// getSpendingPlanData; every mutation is an awaited per-intent action with
// optimistic UI + rollback (Corrections-panel pattern). The zustand copy
// remains a read mirror for not-yet-converted consumers (summary,
// dashboard home) and is never flushed back.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  useFlowStore,
  type SpendingPlanData,
} from "@/lib/store/flow-store";
import {
  addFixedCostLineItem as addLineItemAction,
  getSpendingPlanData,
  removeFixedCostLineItem as removeLineItemAction,
  reorderFixedCostLineItems as reorderAction,
  saveSpendingPlan as savePlanAction,
  updateFixedCostLineItem as updateLineItemAction,
  type LineItemInput,
  type PlanResult,
  type SavePlanInput,
} from "@/app/actions/spending-plan";
import { generateId } from "@/lib/utils/validation";

function mirror(plan: SpendingPlanData | null) {
  useFlowStore.setState({ spendingPlan: plan });
}

export function useSpendingPlan() {
  const { isAuthenticated, loading } = useAuth();
  const spendingPlan = useFlowStore((s) => s.spendingPlan);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the mirror from server truth on mount — both flow pages and any
  // dashboard consumer answer from the same rows.
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    getSpendingPlanData().then((plan) => {
      if (plan) mirror(plan);
    });
  }, [isAuthenticated, loading]);

  async function run(
    optimistic: () => void,
    action: () => Promise<PlanResult>
  ): Promise<boolean> {
    setError(null);
    const previous = useFlowStore.getState().spendingPlan;
    optimistic();
    const result = await action();
    if ("error" in result && result.error) {
      mirror(previous);
      setError(result.error);
      return false;
    }
    if (result.ok) mirror(result.plan);
    return true;
  }

  const savePlan = (input: SavePlanInput) =>
    run(
      () => {
        const current = useFlowStore.getState().spendingPlan;
        mirror({
          fixedCostLineItems: current?.fixedCostLineItems ?? [],
          ...input,
        });
      },
      () => savePlanAction(input)
    );

  const addLineItem = (input: LineItemInput) =>
    run(
      () =>
        useFlowStore.getState().addFixedCostLineItem({
          id: generateId(),
          category: input.category as never,
          name: input.name,
          monthlyAmount: input.monthlyAmount,
          note: input.note,
          sortOrder:
            useFlowStore.getState().spendingPlan?.fixedCostLineItems.length ??
            0,
        }),
      () => addLineItemAction(input)
    );

  const updateLineItem = (id: string, patch: Partial<LineItemInput>) =>
    run(
      () =>
        useFlowStore.getState().updateFixedCostLineItem(id, {
          ...(patch.category !== undefined
            ? { category: patch.category as never }
            : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.monthlyAmount !== undefined
            ? { monthlyAmount: patch.monthlyAmount }
            : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
        }),
      () => updateLineItemAction(id, patch)
    );

  const removeLineItem = (id: string) =>
    run(
      () => useFlowStore.getState().removeFixedCostLineItem(id),
      () => removeLineItemAction(id)
    );

  const reorderLineItems = (orderedIds: string[]) =>
    run(
      () => useFlowStore.getState().reorderFixedCostLineItems(orderedIds),
      () => reorderAction(orderedIds)
    );

  return {
    spendingPlan,
    error,
    savePlan,
    addLineItem,
    updateLineItem,
    removeLineItem,
    reorderLineItems,
  };
}
