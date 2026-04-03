"use client";

import { useFlowStore } from "./flow-store";

export async function syncLocalToServer() {
  const flowState = useFlowStore.getState();

  if (!flowState.isComplete && Object.keys(flowState.scripts).length === 0) {
    return { synced: false, reason: "no-data" };
  }

  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scripts: flowState.scripts,
        moneyType: flowState.moneyType,
        debts: flowState.debts,
        incomeSources: flowState.incomeSources,
        spendingPlan: flowState.spendingPlan,
        moneyDials: flowState.moneyDials,
        isComplete: flowState.isComplete,
      }),
    });

    if (!response.ok) {
      throw new Error("Sync failed");
    }

    // Clear localStorage after successful sync
    useFlowStore.getState().reset();

    return { synced: true };
  } catch (error) {
    console.error("Failed to sync local data to server:", error);
    return { synced: false, reason: "error" };
  }
}

export function hasLocalData(): boolean {
  const state = useFlowStore.getState();
  return (
    Object.keys(state.scripts).length > 0 ||
    state.moneyType !== null ||
    state.debts.length > 0 ||
    state.incomeSources.length > 0 ||
    state.spendingPlan !== null
  );
}
