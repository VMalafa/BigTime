"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FixedCostCategory } from "@/lib/constants/csp-ranges";

export type MoneyType = "OPTIMIZER" | "AVOIDER" | "WORRIER" | "DREAMER";

export type DebtType =
  | "CREDIT_CARD"
  | "PERSONAL_LOAN"
  | "STUDENT_LOAN"
  | "AUTO_LOAN"
  | "MORTGAGE"
  | "MEDICAL"
  | "OTHER_REVOLVING"
  | "OTHER_INSTALLMENT";

export type DialCategory =
  | "TRAVEL"
  | "FOOD_DINING"
  | "HEALTH_FITNESS"
  | "CONVENIENCE"
  | "TECHNOLOGY"
  | "FASHION"
  | "EXPERIENCES"
  | "EDUCATION"
  | "GIVING";

export interface DebtEntry {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  debtType: DebtType;
  creditLimit?: number;
  isShared?: boolean;
}

export interface IncomeEntry {
  id: string;
  name: string;
  monthlyAmount: number;
  isAfterTax: boolean;
}

export type BonusFrequency =
  | "ONE_TIME"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUAL";

export interface BonusEntry {
  id: string;
  name: string;
  grossAmount: number;
  estimatedTaxRate: number;
  frequency: BonusFrequency;
  expectedDate?: string; // ISO date (YYYY-MM-DD)
  notes?: string;
}

export interface FixedCostLineItem {
  id: string;
  category: FixedCostCategory;
  name: string;
  monthlyAmount: number;
  note?: string;
  sortOrder: number;
}

export interface SpendingPlanData {
  fixedCostsPercent: number;
  savingsPercent: number;
  investmentsPercent: number;
  guiltFreePercent: number;
  fixedCostLineItems: FixedCostLineItem[];
  fixedCostsOverridden: boolean;
}

interface FlowState {
  currentStep: number;
  scripts: Record<number, string>;
  moneyType: MoneyType | null;
  debts: DebtEntry[];
  incomeSources: IncomeEntry[];
  bonusItems: BonusEntry[];
  spendingPlan: SpendingPlanData | null;
  moneyDials: Record<DialCategory, number>;
  isComplete: boolean;

  // Auth-aware persistence
  _isAuthenticated: boolean;
  _isHydrated: boolean;

  // Actions
  setCurrentStep: (step: number) => void;
  setScript: (promptId: number, response: string) => void;
  setMoneyType: (type: MoneyType) => void;
  addDebt: (debt: DebtEntry) => void;
  updateDebt: (id: string, debt: Partial<DebtEntry>) => void;
  removeDebt: (id: string) => void;
  addIncome: (income: IncomeEntry) => void;
  updateIncome: (id: string, income: Partial<IncomeEntry>) => void;
  removeIncome: (id: string) => void;
  addBonus: (bonus: BonusEntry) => void;
  updateBonus: (id: string, patch: Partial<BonusEntry>) => void;
  removeBonus: (id: string) => void;
  setSpendingPlan: (plan: SpendingPlanData) => void;
  addFixedCostLineItem: (item: FixedCostLineItem) => void;
  updateFixedCostLineItem: (id: string, patch: Partial<FixedCostLineItem>) => void;
  removeFixedCostLineItem: (id: string) => void;
  reorderFixedCostLineItems: (orderedIds: string[]) => void;
  setFixedCostsOverridden: (flag: boolean) => void;
  setMoneyDial: (category: DialCategory, level: number) => void;
  setComplete: (complete: boolean) => void;
  getTotalMonthlyIncome: () => number;
  getTotalAnnualBonusNet: () => number;
  getMonthlyBonusEquivalent: () => number;
  getEffectiveMonthlyIncome: () => number;
  getFixedCostsTotalMonthly: () => number;
  getSuggestedFixedCostsPercent: () => number;
  getRemainingDiscretionaryMonthly: () => number;
  reset: () => void;

  // Hydration
  hydrateFromDb: (data: {
    scripts: Record<number, string>;
    moneyType: MoneyType | null;
    debts: DebtEntry[];
    incomeSources: IncomeEntry[];
    bonusItems: BonusEntry[];
    spendingPlan: SpendingPlanData | null;
    moneyDials: Record<DialCategory, number>;
  }) => void;
  setAuthenticated: (isAuth: boolean) => void;
}

const initialDials: Record<DialCategory, number> = {
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

const emptySpendingPlan = (): SpendingPlanData => ({
  fixedCostsPercent: 0,
  savingsPercent: 0,
  investmentsPercent: 0,
  guiltFreePercent: 0,
  fixedCostLineItems: [],
  fixedCostsOverridden: false,
});

// Older persisted shapes may be missing fields added in newer versions.
// Always backfill line-item state so downstream selectors never see `undefined`.
function normalizeSpendingPlan(
  plan: SpendingPlanData | null | undefined
): SpendingPlanData | null {
  if (!plan) return null;
  return {
    fixedCostsPercent: plan.fixedCostsPercent ?? 0,
    savingsPercent: plan.savingsPercent ?? 0,
    investmentsPercent: plan.investmentsPercent ?? 0,
    guiltFreePercent: plan.guiltFreePercent ?? 0,
    fixedCostLineItems: plan.fixedCostLineItems ?? [],
    fixedCostsOverridden: plan.fixedCostsOverridden ?? false,
  };
}

function computeSuggestedPercent(plan: SpendingPlanData, totalIncome: number): number {
  if (totalIncome <= 0) return 0;
  const total = plan.fixedCostLineItems.reduce((s, i) => s + i.monthlyAmount, 0);
  return Math.round((total / totalIncome) * 100);
}

// After any line-item mutation, if the user has not overridden Fixed Costs,
// keep `fixedCostsPercent` in sync with the freshly-derived suggested value.
function syncSuggestedPercent(
  plan: SpendingPlanData,
  totalIncome: number
): SpendingPlanData {
  if (plan.fixedCostsOverridden) return plan;
  const suggested = computeSuggestedPercent(plan, totalIncome);
  if (suggested === plan.fixedCostsPercent) return plan;
  return { ...plan, fixedCostsPercent: suggested };
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      scripts: {},
      moneyType: null,
      debts: [],
      incomeSources: [],
      bonusItems: [],
      spendingPlan: null,
      moneyDials: { ...initialDials },
      isComplete: false,
      _isAuthenticated: false,
      _isHydrated: false,

      setCurrentStep: (step) => set({ currentStep: step }),
      setScript: (promptId, response) =>
        set((state) => ({
          scripts: { ...state.scripts, [promptId]: response },
        })),
      setMoneyType: (type) => set({ moneyType: type }),
      addDebt: (debt) =>
        set((state) => ({ debts: [...state.debts, debt] })),
      updateDebt: (id, updates) =>
        set((state) => ({
          debts: state.debts.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),
      removeDebt: (id) =>
        set((state) => ({
          debts: state.debts.filter((d) => d.id !== id),
        })),
      addIncome: (income) =>
        set((state) => ({
          incomeSources: [...state.incomeSources, income],
        })),
      updateIncome: (id, updates) =>
        set((state) => ({
          incomeSources: state.incomeSources.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
        })),
      removeIncome: (id) =>
        set((state) => ({
          incomeSources: state.incomeSources.filter((i) => i.id !== id),
        })),
      addBonus: (bonus) =>
        set((state) => ({ bonusItems: [...state.bonusItems, bonus] })),
      updateBonus: (id, patch) =>
        set((state) => ({
          bonusItems: state.bonusItems.map((b) =>
            b.id === id ? { ...b, ...patch } : b
          ),
        })),
      removeBonus: (id) =>
        set((state) => ({
          bonusItems: state.bonusItems.filter((b) => b.id !== id),
        })),
      setSpendingPlan: (plan) =>
        set({ spendingPlan: normalizeSpendingPlan(plan) }),
      addFixedCostLineItem: (item) =>
        set((state) => {
          const base = state.spendingPlan ?? emptySpendingPlan();
          const nextItems = [...base.fixedCostLineItems, item];
          const totalIncome = state.incomeSources.reduce(
            (s, i) => s + i.monthlyAmount,
            0
          );
          return {
            spendingPlan: syncSuggestedPercent(
              { ...base, fixedCostLineItems: nextItems },
              totalIncome
            ),
          };
        }),
      updateFixedCostLineItem: (id, patch) =>
        set((state) => {
          if (!state.spendingPlan) return {};
          const nextItems = state.spendingPlan.fixedCostLineItems.map((i) =>
            i.id === id ? { ...i, ...patch } : i
          );
          const totalIncome = state.incomeSources.reduce(
            (s, i) => s + i.monthlyAmount,
            0
          );
          return {
            spendingPlan: syncSuggestedPercent(
              { ...state.spendingPlan, fixedCostLineItems: nextItems },
              totalIncome
            ),
          };
        }),
      removeFixedCostLineItem: (id) =>
        set((state) => {
          if (!state.spendingPlan) return {};
          const nextItems = state.spendingPlan.fixedCostLineItems.filter(
            (i) => i.id !== id
          );
          const totalIncome = state.incomeSources.reduce(
            (s, i) => s + i.monthlyAmount,
            0
          );
          return {
            spendingPlan: syncSuggestedPercent(
              { ...state.spendingPlan, fixedCostLineItems: nextItems },
              totalIncome
            ),
          };
        }),
      reorderFixedCostLineItems: (orderedIds) =>
        set((state) => {
          if (!state.spendingPlan) return {};
          const byId = new Map(
            state.spendingPlan.fixedCostLineItems.map((i) => [i.id, i])
          );
          const nextItems = orderedIds
            .map((id, index) => {
              const item = byId.get(id);
              return item ? { ...item, sortOrder: index } : null;
            })
            .filter((i): i is FixedCostLineItem => i !== null);
          return {
            spendingPlan: {
              ...state.spendingPlan,
              fixedCostLineItems: nextItems,
            },
          };
        }),
      setFixedCostsOverridden: (flag) =>
        set((state) => {
          if (!state.spendingPlan) return {};
          return {
            spendingPlan: { ...state.spendingPlan, fixedCostsOverridden: flag },
          };
        }),
      setMoneyDial: (category, level) =>
        set((state) => ({
          moneyDials: { ...state.moneyDials, [category]: level },
        })),
      setComplete: (complete) => set({ isComplete: complete }),
      getTotalMonthlyIncome: () => {
        const state = get();
        return state.incomeSources.reduce(
          (sum, s) => sum + s.monthlyAmount,
          0
        );
      },
      getTotalAnnualBonusNet: () => {
        const state = get();
        return state.bonusItems.reduce((sum, b) => {
          const net = b.grossAmount * (1 - b.estimatedTaxRate / 100);
          const perYear =
            b.frequency === "QUARTERLY"
              ? 4
              : b.frequency === "SEMI_ANNUAL"
                ? 2
                : 1;
          return sum + net * perYear;
        }, 0);
      },
      getMonthlyBonusEquivalent: () => {
        return get().getTotalAnnualBonusNet() / 12;
      },
      getEffectiveMonthlyIncome: () => {
        const state = get();
        return state.getTotalMonthlyIncome() + state.getMonthlyBonusEquivalent();
      },
      getFixedCostsTotalMonthly: () => {
        const plan = get().spendingPlan;
        if (!plan) return 0;
        return plan.fixedCostLineItems.reduce(
          (sum, i) => sum + i.monthlyAmount,
          0
        );
      },
      getSuggestedFixedCostsPercent: () => {
        const state = get();
        if (!state.spendingPlan) return 0;
        const totalIncome = state.incomeSources.reduce(
          (s, i) => s + i.monthlyAmount,
          0
        );
        return computeSuggestedPercent(state.spendingPlan, totalIncome);
      },
      getRemainingDiscretionaryMonthly: () => {
        const state = get();
        const totalIncome = state.incomeSources.reduce(
          (s, i) => s + i.monthlyAmount,
          0
        );
        const plan = state.spendingPlan;
        const fixedTotal = plan
          ? plan.fixedCostLineItems.reduce((s, i) => s + i.monthlyAmount, 0)
          : 0;
        return totalIncome - fixedTotal;
      },
      reset: () =>
        set({
          currentStep: 0,
          scripts: {},
          moneyType: null,
          debts: [],
          incomeSources: [],
          bonusItems: [],
          spendingPlan: null,
          moneyDials: { ...initialDials },
          isComplete: false,
        }),

      hydrateFromDb: (data) =>
        set({
          scripts: data.scripts,
          moneyType: data.moneyType,
          debts: data.debts,
          incomeSources: data.incomeSources,
          bonusItems: data.bonusItems ?? [],
          spendingPlan: normalizeSpendingPlan(data.spendingPlan),
          moneyDials: { ...initialDials, ...data.moneyDials },
          _isHydrated: true,
        }),
      setAuthenticated: (isAuth) => set({ _isAuthenticated: isAuth }),
    }),
    {
      name: "rich-life-flow",
      partialize: (state) => {
        // Don't persist internal flags to localStorage
        const { _isAuthenticated, _isHydrated, ...rest } = state;
        void _isAuthenticated;
        void _isHydrated;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        // Backfill fields on plans saved by older app versions.
        if (state?.spendingPlan) {
          state.spendingPlan = normalizeSpendingPlan(state.spendingPlan);
        }
      },
    }
  )
);
