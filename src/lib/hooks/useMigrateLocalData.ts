"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { migrateFlowData } from "@/app/actions/migrate-flow";

const STORAGE_KEY = "rich-life-flow";

export function useMigrateLocalData() {
  const { isAuthenticated, loading } = useAuth();
  const migratedRef = useRef(false);

  useEffect(() => {
    if (loading || !isAuthenticated || migratedRef.current) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const state = parsed?.state;

      if (!state) return;

      // Check if there's actual data worth migrating
      const hasData =
        (state.scripts && Object.keys(state.scripts).length > 0) ||
        state.moneyType ||
        (state.debts && state.debts.length > 0) ||
        (state.incomeSources && state.incomeSources.length > 0) ||
        state.spendingPlan;

      if (!hasData) return;

      migratedRef.current = true;

      migrateFlowData({
        scripts: state.scripts,
        moneyType: state.moneyType,
        debts: state.debts,
        incomeSources: state.incomeSources,
        spendingPlan: state.spendingPlan,
        moneyDials: state.moneyDials,
      }).then((result) => {
        if (result.success) {
          localStorage.removeItem(STORAGE_KEY);
        }
      });
    } catch {
      // Malformed localStorage data — ignore
      console.warn("Could not parse localStorage flow data for migration");
    }
  }, [isAuthenticated, loading]);
}
