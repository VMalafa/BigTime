"use client";

// The flow store after #53: UI state only. Every domain entity lives in
// the database and reaches the client through explicit fetch actions and
// the per-intent hooks (useIncomeData, useSpendingPlan, useDebts,
// useReflection) — no domain data in zustand or localStorage, ever. What
// persists here is the onboarding position, nothing a household member
// typed.
//
// The domain TYPES remain exported from this module: they are the shared
// client vocabulary the hooks and actions speak, heavily imported across
// the app — the data left, the language stayed.

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
  isComplete: boolean;

  setCurrentStep: (step: number) => void;
  setComplete: (complete: boolean) => void;
  reset: () => void;
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set) => ({
      currentStep: 0,
      isComplete: false,

      setCurrentStep: (step) => set({ currentStep: step }),
      setComplete: (complete) => set({ isComplete: complete }),
      reset: () => set({ currentStep: 0, isComplete: false }),
    }),
    {
      name: "rich-life-flow",
    }
  )
);
