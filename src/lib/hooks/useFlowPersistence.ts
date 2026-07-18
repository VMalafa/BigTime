"use client";

import { useEffect } from "react";
import { useFlowStore } from "@/lib/store/flow-store";
import { useAuth } from "@/lib/hooks/useAuth";
import { loadProfileFlowData } from "@/app/actions/flow-persistence";

// With every domain entity converted to awaited per-intent actions
// (#49-#52), there is nothing left to flush — the debounced
// subscribe-and-flush machinery is gone. What remains is the
// hydrate-on-auth read that fills the store's read mirror for the
// not-yet-converted consumers; #53 retires that too and shrinks the store
// to UI state.
export function useFlowPersistence() {
  const { isAuthenticated, loading } = useAuth();

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
}
