"use client";

// Server-authoritative Conscious Spending Plan (#50; cache home per #53):
// reads hydrate from getSpendingPlanData into a shared in-memory cache;
// every mutation is an awaited per-intent action with optimistic UI +
// rollback (Corrections-panel pattern). No zustand, no localStorage.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import type {
  FixedCostLineItem,
  SpendingPlanData,
} from "@/lib/store/flow-store";
import { createEntityCache } from "@/lib/hooks/entity-cache";
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

export const planCache = createEntityCache<SpendingPlanData | null>(null);

function mutateLineItems(
  mutate: (items: FixedCostLineItem[]) => FixedCostLineItem[]
) {
  planCache.set((plan) => {
    const base: SpendingPlanData = plan ?? {
      fixedCostsPercent: 0,
      savingsPercent: 0,
      investmentsPercent: 0,
      guiltFreePercent: 0,
      fixedCostsOverridden: false,
      fixedCostLineItems: [],
    };
    return { ...base, fixedCostLineItems: mutate(base.fixedCostLineItems) };
  });
}

export function useSpendingPlan() {
  const { isAuthenticated, loading } = useAuth();
  const spendingPlan = planCache.use();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    getSpendingPlanData().then((plan) => {
      if (plan) planCache.set(plan);
    });
  }, [isAuthenticated, loading]);

  async function run(
    optimistic: () => void,
    action: () => Promise<PlanResult>
  ): Promise<boolean> {
    setError(null);
    const previous = planCache.get();
    optimistic();
    const result = await action();
    if ("error" in result && result.error) {
      planCache.set(previous);
      setError(result.error);
      return false;
    }
    if (result.ok) planCache.set(result.plan);
    return true;
  }

  const savePlan = (input: SavePlanInput) =>
    run(
      () =>
        planCache.set((plan) => ({
          fixedCostLineItems: plan?.fixedCostLineItems ?? [],
          ...input,
        })),
      () => savePlanAction(input)
    );

  const addLineItem = (input: LineItemInput) =>
    run(
      () =>
        mutateLineItems((items) => [
          ...items,
          {
            id: generateId(),
            category: input.category as FixedCostLineItem["category"],
            name: input.name,
            monthlyAmount: input.monthlyAmount,
            note: input.note,
            sortOrder: items.length,
          },
        ]),
      () => addLineItemAction(input)
    );

  const updateLineItem = (id: string, patch: Partial<LineItemInput>) =>
    run(
      () =>
        mutateLineItems((items) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(patch.category !== undefined
                    ? {
                        category:
                          patch.category as FixedCostLineItem["category"],
                      }
                    : {}),
                  ...(patch.name !== undefined ? { name: patch.name } : {}),
                  ...(patch.monthlyAmount !== undefined
                    ? { monthlyAmount: patch.monthlyAmount }
                    : {}),
                  ...(patch.note !== undefined ? { note: patch.note } : {}),
                }
              : item
          )
        ),
      () => updateLineItemAction(id, patch)
    );

  const removeLineItem = (id: string) =>
    run(
      () => mutateLineItems((items) => items.filter((item) => item.id !== id)),
      () => removeLineItemAction(id)
    );

  const reorderLineItems = (orderedIds: string[]) =>
    run(
      () =>
        mutateLineItems((items) => {
          const byId = new Map(items.map((item) => [item.id, item]));
          return orderedIds
            .map((id, index) => {
              const item = byId.get(id);
              return item ? { ...item, sortOrder: index } : null;
            })
            .filter((item): item is FixedCostLineItem => item !== null);
        }),
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
