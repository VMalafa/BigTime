"use client";

// The reflective trio's client home (#52 actions; cache per #53): scripts,
// Money Type, and Money Dials hydrate from getReflectionData into a shared
// in-memory cache; local setters keep typing/drag responsive while the
// per-intent saves (wired in the flow pages) commit each change. No
// zustand, no localStorage.

import { useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import type { DialCategory, MoneyType } from "@/lib/store/flow-store";
import { createEntityCache } from "@/lib/hooks/entity-cache";
import { getReflectionData } from "@/app/actions/reflection";

export interface ReflectionState {
  scripts: Record<number, string>;
  moneyType: MoneyType | null;
  moneyDials: Record<DialCategory, number>;
}

export const DEFAULT_DIALS: Record<DialCategory, number> = {
  TRAVEL: 5,
  FOOD_DINING: 5,
  HEALTH_FITNESS: 5,
  CONVENIENCE: 5,
  TECHNOLOGY: 5,
  FASHION: 5,
  EXPERIENCES: 5,
  EDUCATION: 5,
  GIVING: 5,
};

export const reflectionCache = createEntityCache<ReflectionState>({
  scripts: {},
  moneyType: null,
  moneyDials: { ...DEFAULT_DIALS },
});

export function useReflection() {
  const { isAuthenticated, loading } = useAuth();
  const state = reflectionCache.use();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    void reflectionCache.hydrate(async () => {
      const data = await getReflectionData();
      if (!data) return null;
      return {
        scripts: data.scripts,
        moneyType: data.moneyType,
        moneyDials: { ...DEFAULT_DIALS, ...data.moneyDials },
      };
    });
  }, [isAuthenticated, loading]);

  return {
    ...state,
    setScriptLocal: (promptId: number, response: string) =>
      reflectionCache.set((s) => ({
        ...s,
        scripts: { ...s.scripts, [promptId]: response },
      })),
    setMoneyTypeLocal: (moneyType: MoneyType | null) =>
      reflectionCache.set((s) => ({ ...s, moneyType })),
    setMoneyDialLocal: (category: DialCategory, level: number) =>
      reflectionCache.set((s) => ({
        ...s,
        moneyDials: { ...s.moneyDials, [category]: level },
      })),
  };
}
