"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export interface SpendingPlanData {
  fixedCostsPercent: number;
  savingsPercent: number;
  investmentsPercent: number;
  guiltFreePercent: number;
}

interface FlowState {
  currentStep: number;
  scripts: Record<number, string>;
  moneyType: MoneyType | null;
  debts: DebtEntry[];
  incomeSources: IncomeEntry[];
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
  setSpendingPlan: (plan: SpendingPlanData) => void;
  setMoneyDial: (category: DialCategory, level: number) => void;
  setComplete: (complete: boolean) => void;
  getTotalMonthlyIncome: () => number;
  reset: () => void;

  // Hydration
  hydrateFromDb: (data: {
    scripts: Record<number, string>;
    moneyType: MoneyType | null;
    debts: DebtEntry[];
    incomeSources: IncomeEntry[];
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

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      scripts: {},
      moneyType: null,
      debts: [],
      incomeSources: [],
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
      setSpendingPlan: (plan) => set({ spendingPlan: plan }),
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
      reset: () =>
        set({
          currentStep: 0,
          scripts: {},
          moneyType: null,
          debts: [],
          incomeSources: [],
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
          spendingPlan: data.spendingPlan,
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
    }
  )
);
