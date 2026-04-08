"use client";

import { useEffect, useRef } from "react";
import { useFlowStore } from "@/lib/store/flow-store";
import { useAuth } from "@/lib/hooks/useAuth";
import { loadProfileFlowData } from "@/app/actions/flow-persistence";
import {
  persistScripts,
  persistMoneyType,
  persistDebts,
  persistIncomeSources,
  persistSpendingPlan,
  persistMoneyDials,
} from "@/app/actions/flow-persistence";

export function useFlowPersistence() {
  const { isAuthenticated, loading } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStateRef = useRef<string>("");

  // Hydrate from DB when authenticated
  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const store = useFlowStore.getState();
    store.setAuthenticated(true);

    loadProfileFlowData().then((data) => {
      if (data) {
        store.hydrateFromDb(data);
      }
    });
  }, [isAuthenticated, loading]);

  // Subscribe to store changes and persist to DB (debounced)
  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const unsubscribe = useFlowStore.subscribe((state) => {
      if (!state._isAuthenticated || !state._isHydrated) return;

      // Serialize relevant state to detect actual changes. `spendingPlan`
      // already includes `fixedCostLineItems` and `fixedCostsOverridden`, so
      // edits to line items flow through the same debounced flush.
      const stateKey = JSON.stringify({
        scripts: state.scripts,
        moneyType: state.moneyType,
        debts: state.debts,
        incomeSources: state.incomeSources,
        spendingPlan: state.spendingPlan,
        moneyDials: state.moneyDials,
      });

      if (stateKey === prevStateRef.current) return;
      prevStateRef.current = stateKey;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        try {
          await Promise.all([
            persistScripts(state.scripts),
            state.moneyType ? persistMoneyType(state.moneyType) : null,
            persistDebts(state.debts),
            persistIncomeSources(state.incomeSources),
            state.spendingPlan
              ? persistSpendingPlan(state.spendingPlan)
              : null,
            persistMoneyDials(state.moneyDials),
          ]);
        } catch (err) {
          console.error("Failed to persist flow data to DB:", err);
        }
      }, 500);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isAuthenticated, loading]);
}
